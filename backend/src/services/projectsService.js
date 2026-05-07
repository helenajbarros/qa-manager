const { db } = require("../database/connection");
const path   = require("path");
const fs     = require("fs");

function getUploadDir() {
  return process.env.QA_UPLOAD_DIR || path.resolve(__dirname, "../../uploads");
}

function findAll() {
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM modules     m WHERE m.project_id = p.id) as module_count,
      (SELECT COUNT(*) FROM test_cycles c WHERE c.project_id = p.id) as cycle_count,
      (SELECT COUNT(*) FROM bugs        b WHERE b.project_id = p.id) as bug_count
    FROM projects p ORDER BY p.name
  `).all();
}

function findById(id) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
}

function create({ name, description }) {
  const r = db.prepare("INSERT INTO projects (name, description) VALUES (?,?)")
    .run(name.trim(), description ?? null);
  return findById(r.lastInsertRowid);
}

function update(id, { name, description, active, logo_url }) {
  const cur = findById(id);
  if (!cur) return null;
  db.prepare("UPDATE projects SET name=?, description=?, active=?, logo_url=? WHERE id=?")
    .run(name?.trim() ?? cur.name, description ?? cur.description,
         active !== undefined ? (active ? 1 : 0) : cur.active,
         logo_url !== undefined ? logo_url : cur.logo_url, id);
  return findById(id);
}

function saveLogo(id, filename) {
  const cur = findById(id);
  if (cur?.logo_url) {
    const old = path.resolve(getUploadDir(), cur.logo_url);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  db.prepare("UPDATE projects SET logo_url=? WHERE id=?").run(filename, id);
  return findById(id);
}

function remove(id) {
  return db.prepare("DELETE FROM projects WHERE id=?").run(id);
}

module.exports = { findAll, findById, create, update, saveLogo, remove };
