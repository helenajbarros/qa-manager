const { db } = require("../database/connection");

function findAll({ project_id, search } = {}) {
  const conds = []; const params = [];
  if (project_id) { conds.push("m.project_id = ?"); params.push(project_id); }
  if (search)     { conds.push("LOWER(m.name) LIKE ?"); params.push(`%${search.toLowerCase()}%`); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  return db.prepare(`
    SELECT m.*, COUNT(tc.id) AS test_count
    FROM modules m LEFT JOIN test_cases tc ON tc.module_id = m.id
    ${where} GROUP BY m.id ORDER BY m.name
  `).all(...params);
}

function findById(id) { return db.prepare("SELECT * FROM modules WHERE id=?").get(id); }

function create({ name, description, project_id }) {
  const r = db.prepare("INSERT INTO modules (name,description,project_id) VALUES (?,?,?)")
    .run(name.trim(), description??null, project_id??1);
  return findById(r.lastInsertRowid);
}

function update(id, { name, description }) {
  db.prepare("UPDATE modules SET name=?,description=? WHERE id=?").run(name.trim(), description??null, id);
  return findById(id);
}

function remove(id) { return db.prepare("DELETE FROM modules WHERE id=?").run(id); }

module.exports = { findAll, findById, create, update, remove };
