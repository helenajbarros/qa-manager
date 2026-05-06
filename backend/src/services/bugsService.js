const { db } = require("../database/connection");
const path   = require("path");
const fs     = require("fs");

function extractModuleId(title) {
  const m = title.match(/^\[(.+?)\]/);
  if (!m) return null;
  const r = db.prepare("SELECT id FROM modules WHERE LOWER(name)=?").get(m[1].trim().toLowerCase());
  return r?.id ?? null;
}

const BASE = `
  SELECT b.*, m.name AS module_name, u.name AS created_by_name, tc.title AS test_case_title
  FROM bugs b
  LEFT JOIN modules    m  ON m.id  = b.module_id
  LEFT JOIN users      u  ON u.id  = b.created_by_id
  LEFT JOIN test_cases tc ON tc.id = b.test_case_id
`;

function getFiles(bug_id) {
  return db.prepare("SELECT * FROM evidence_files WHERE ref_type='bug' AND ref_id=? ORDER BY created_at").all(bug_id);
}

function attachFiles(bug) {
  return bug ? { ...bug, evidence_files: getFiles(bug.id) } : undefined;
}

function findAll({ status, severity, module_id, project_id, search } = {}) {
  const c = []; const p = [];
  if (project_id) { c.push("b.project_id=?"); p.push(project_id); }
  if (status)     { c.push("b.status=?");      p.push(status); }
  if (severity)   { c.push("b.severity=?");    p.push(severity); }
  if (module_id)  { c.push("b.module_id=?");   p.push(module_id); }
  if (search)     { c.push("(LOWER(b.title) LIKE ? OR LOWER(b.description) LIKE ?)");
                    p.push(`%${search.toLowerCase()}%`,`%${search.toLowerCase()}%`); }
  const w = c.length ? `WHERE ${c.join(" AND ")}` : "";
  return db.prepare(`${BASE} ${w} ORDER BY b.created_at DESC`).all(...p).map(attachFiles);
}

function findById(id) { return attachFiles(db.prepare(`${BASE} WHERE b.id=?`).get(id)); }

function create({ title, description, comment, tracker_url, severity, status, module_id, test_case_id, created_by_id, project_id }) {
  const mod = module_id ?? extractModuleId(title);
  const r = db.prepare(`
    INSERT INTO bugs (title,description,comment,tracker_url,severity,status,module_id,test_case_id,created_by_id,project_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(title.trim(), description??null, comment??null, tracker_url??null,
         severity??"medium", status??"open", mod, test_case_id??null, created_by_id??null, project_id??1);
  return findById(r.lastInsertRowid);
}

function update(id, { title, description, comment, tracker_url, severity, status, module_id, test_case_id }) {
  const mod = module_id !== undefined ? module_id : extractModuleId(title);
  db.prepare(`
    UPDATE bugs SET title=?,description=?,comment=?,tracker_url=?,severity=?,status=?,module_id=?,test_case_id=?
    WHERE id=?
  `).run(title.trim(), description??null, comment??null, tracker_url??null,
         severity??"medium", status??"open", mod, test_case_id??null, id);
  return findById(id);
}

function addFile(bug_id, { filename, originalname, mimetype, size }) {
  db.prepare("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('bug',?,?,?,?,?)")
    .run(bug_id, filename, originalname, mimetype, size);
  return getFiles(bug_id);
}

function removeFile(bug_id, file_id) {
  const f = db.prepare("SELECT * FROM evidence_files WHERE id=? AND ref_type='bug' AND ref_id=?").get(file_id, bug_id);
  if (f) {
    const full = path.resolve(__dirname, "../../uploads", f.filename);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    db.prepare("DELETE FROM evidence_files WHERE id=?").run(file_id);
  }
  return getFiles(bug_id);
}

function remove(id) { return db.prepare("DELETE FROM bugs WHERE id=?").run(id); }

module.exports = { findAll, findById, create, update, remove, addFile, removeFile };
