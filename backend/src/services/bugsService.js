const { query, execute } = require("../database/connection");

async function extractModuleId(title) {
  const match = title.match(/^\[(.+?)\]/);
  if (!match) return null;
  const rows = await query("SELECT id FROM modules WHERE LOWER(name) = $1", [match[1].trim().toLowerCase()]);
  return rows[0]?.id ?? null;
}

const BASE = `
  SELECT b.*,
    m.name  AS module_name,
    u.name  AS created_by_name,
    a.name  AS assigned_to_name,
    tc.title AS test_case_title
  FROM bugs b
  LEFT JOIN modules    m  ON m.id  = b.module_id
  LEFT JOIN users      u  ON u.id  = b.created_by_id
  LEFT JOIN users      a  ON a.id  = b.assigned_to_id
  LEFT JOIN test_cases tc ON tc.id = b.test_case_id
`;

async function getFiles(bug_id) {
  return query("SELECT * FROM evidence_files WHERE ref_type='bug' AND ref_id=$1 ORDER BY created_at", [bug_id]);
}

async function getRelations(bug_id) {
  const rows = await query(`
    SELECT br.id, br.related_bug_id,
      b.title, b.status, b.severity, m.name AS module_name
    FROM bug_relations br
    JOIN bugs b ON b.id = br.related_bug_id
    LEFT JOIN modules m ON m.id = b.module_id
    WHERE br.bug_id = $1
  `, [bug_id]);
  return rows;
}

async function attachAll(bug) {
  if (!bug) return undefined;
  const [files, relations] = await Promise.all([
    getFiles(bug.id),
    getRelations(bug.id),
  ]);
  return { ...bug, evidence_files: files, related_bugs: relations };
}

async function findAll({ status, severity, module_id, project_id, search, page, limit } = {}) {
  const conds = ["1=1"]; const params = [];
  if (project_id) { params.push(project_id); conds.push(`b.project_id = $${params.length}`); }
  if (status)     { params.push(status);      conds.push(`b.status = $${params.length}`); }
  if (severity)   { params.push(severity);    conds.push(`b.severity = $${params.length}`); }
  if (module_id)  { params.push(module_id);   conds.push(`b.module_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(b.title) LIKE $${params.length}`); }

  const where = conds.join(" AND ");

  // Paginação
  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset   = (pageNum - 1) * pageSize;

  // Total sem paginação
  const countRows = await query(`SELECT COUNT(*) AS total FROM bugs b WHERE ${where}`, params);
  const total = parseInt(countRows[0]?.total || 0);

  params.push(pageSize); const limitIdx  = params.length;
  params.push(offset);   const offsetIdx = params.length;
  const rows = await query(
    `${BASE} WHERE ${where} ORDER BY b.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  const data = await Promise.all(rows.map(attachAll));
  return { data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
}

async function findById(id) {
  const rows = await query(`${BASE} WHERE b.id=$1`, [id]);
  return attachAll(rows[0]);
}

async function logActivity(bug_id, user_id, action, detail) {
  try {
    await query(
      "INSERT INTO bug_activity (bug_id, user_id, action, detail) VALUES ($1,$2,$3,$4)",
      [bug_id, user_id||null, action, detail||null]
    );
  } catch(_) {}
}

async function getActivity(bug_id) {
  return query(`
    SELECT ba.*, u.name AS user_name
    FROM bug_activity ba
    LEFT JOIN users u ON u.id = ba.user_id
    WHERE ba.bug_id = $1
    ORDER BY ba.created_at ASC
  `, [bug_id]);
}

async function create({ title, description, comment, tracker_url, severity, status, module_id,
  test_case_id, created_by_id, project_id, assigned_to_id, pr_url, steps }) {
  const mod = module_id || await extractModuleId(title);
  const rows = await query(
    `INSERT INTO bugs (title,description,comment,tracker_url,severity,status,module_id,
      test_case_id,created_by_id,project_id,assigned_to_id,pr_url,steps)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [title.trim(), description||null, comment||null, tracker_url||null,
     severity||"medium", status||"open", mod||null, test_case_id||null,
     created_by_id||null, project_id||1, assigned_to_id||null, pr_url||null, steps||null]
  );
  const bug = await findById(rows[0].id);
  await logActivity(rows[0].id, created_by_id, "criou o bug", null);
  return bug;
}

async function update(id, { title, description, comment, tracker_url, severity, status,
  module_id, test_case_id, assigned_to_id, pr_url, steps }, userId) {
  const prev = await findById(id);
  const mod  = module_id || await extractModuleId(title);
  await execute(
    `UPDATE bugs SET title=$1,description=$2,comment=$3,tracker_url=$4,severity=$5,
      status=$6,module_id=$7,test_case_id=$8,assigned_to_id=$9,pr_url=$10,steps=$11 WHERE id=$12`,
    [title.trim(), description||null, comment||null, tracker_url||null,
     severity||"medium", status||"open", mod||null, test_case_id||null,
     assigned_to_id||null, pr_url||null, steps||null, id]
  );
  // Log de atividades
  if (prev && prev.status !== status) {
    await logActivity(id, userId, "alterou o status", `${prev.status} → ${status}`);
  }
  if (prev && prev.assigned_to_id !== (assigned_to_id||null)) {
    await logActivity(id, userId, "alterou o responsável", null);
  }
  if (prev && prev.title !== title) {
    await logActivity(id, userId, "editou o bug", null);
  }
  return findById(id);
}

async function addRelation(bugId, relatedBugId) {
  try {
    await query("INSERT INTO bug_relations (bug_id, related_bug_id) VALUES ($1,$2)", [bugId, relatedBugId]);
    await query("INSERT INTO bug_relations (bug_id, related_bug_id) VALUES ($1,$2)", [relatedBugId, bugId]);
  } catch(_) {}
  return getRelations(bugId);
}

async function removeRelation(bugId, relatedBugId) {
  await execute("DELETE FROM bug_relations WHERE bug_id=$1 AND related_bug_id=$2", [bugId, relatedBugId]);
  await execute("DELETE FROM bug_relations WHERE bug_id=$1 AND related_bug_id=$2", [relatedBugId, bugId]);
  return getRelations(bugId);
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

module.exports = { findAll, findById, create, update, remove, addFile, removeFile,
  addRelation, removeRelation, getActivity, logActivity };
