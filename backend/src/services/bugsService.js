const { query, execute } = require("../database/connection");

async function extractModuleId(title) {
  const match = title.match(/^\[(.+?)\]/);
  if (!match) return null;
  const rows = await query("SELECT id FROM modules WHERE LOWER(name) = $1", [match[1].trim().toLowerCase()]);
  return rows[0]?.id ?? null;
}

const BASE = `
  SELECT b.*, m.name AS module_name, u.name AS created_by_name, tc.title AS test_case_title
  FROM bugs b
  LEFT JOIN modules    m  ON m.id  = b.module_id
  LEFT JOIN users      u  ON u.id  = b.created_by_id
  LEFT JOIN test_cases tc ON tc.id = b.test_case_id
`;

async function getFiles(bug_id) {
  return query("SELECT * FROM evidence_files WHERE ref_type='bug' AND ref_id=$1 ORDER BY created_at", [bug_id]);
}

async function attachFiles(bug) {
  if (!bug) return undefined;
  return { ...bug, evidence_files: await getFiles(bug.id) };
}

async function findAll({ status, severity, module_id, project_id, search } = {}) {
  const conds = ["1=1"]; const params = [];
  if (project_id) { params.push(project_id); conds.push(`b.project_id = $${params.length}`); }
  if (status)     { params.push(status);      conds.push(`b.status = $${params.length}`); }
  if (severity)   { params.push(severity);    conds.push(`b.severity = $${params.length}`); }
  if (module_id)  { params.push(module_id);   conds.push(`b.module_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(b.title) LIKE $${params.length}`); }
  const rows = await query(`${BASE} WHERE ${conds.join(" AND ")} ORDER BY b.created_at DESC`, params);
  return Promise.all(rows.map(attachFiles));
}

async function findById(id) {
  const rows = await query(`${BASE} WHERE b.id=$1`, [id]);
  return attachFiles(rows[0]);
}

async function create({ title, description, comment, tracker_url, severity, status, module_id, test_case_id, created_by_id, project_id }) {
  const mod = module_id || await extractModuleId(title);
  const rows = await query(
    "INSERT INTO bugs (title,description,comment,tracker_url,severity,status,module_id,test_case_id,created_by_id,project_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
    [title.trim(), description||null, comment||null, tracker_url||null, severity||"medium", status||"open", mod||null, test_case_id||null, created_by_id||null, project_id||1]
  );
  return findById(rows[0].id);
}

async function update(id, { title, description, comment, tracker_url, severity, status, module_id, test_case_id }) {
  const mod = module_id || await extractModuleId(title);
  await execute(
    "UPDATE bugs SET title=$1,description=$2,comment=$3,tracker_url=$4,severity=$5,status=$6,module_id=$7,test_case_id=$8 WHERE id=$9",
    [title.trim(), description||null, comment||null, tracker_url||null, severity||"medium", status||"open", mod||null, test_case_id||null, id]
  );
  return findById(id);
}

async function addFile(bug_id, { filename, originalname, mimetype, size }) {
  await execute("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('bug',$1,$2,$3,$4,$5)",
    [bug_id, filename, originalname, mimetype, size]);
  return getFiles(bug_id);
}

async function removeFile(bug_id, file_id) {
  const rows = await query("SELECT * FROM evidence_files WHERE id=$1 AND ref_type='bug' AND ref_id=$2", [file_id, bug_id]);
  if (rows[0]) {
    const path = require("path"), fs = require("fs");
    const full = path.resolve(process.env.QA_UPLOAD_DIR||"uploads", rows[0].filename);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    await execute("DELETE FROM evidence_files WHERE id=$1", [file_id]);
  }
  return getFiles(bug_id);
}

async function remove(id) {
  return execute("DELETE FROM bugs WHERE id=$1", [id]);
}

module.exports = { findAll, findById, create, update, remove, addFile, removeFile };