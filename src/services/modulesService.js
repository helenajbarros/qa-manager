const { db } = require("../database/connection");

function findAll() {
  return db.prepare(`
    SELECT m.*, COUNT(tc.id) AS test_count
    FROM modules m
    LEFT JOIN test_cases tc ON tc.module_id = m.id
    GROUP BY m.id
    ORDER BY m.name
  `).all();
}

function findById(id) {
  return db.prepare("SELECT * FROM modules WHERE id = ?").get(id);
}

function create({ name, description }) {
  const result = db
    .prepare("INSERT INTO modules (name, description) VALUES (?, ?)")
    .run(name.trim(), description ?? null);
  return findById(result.lastInsertRowid);
}

function update(id, { name, description }) {
  db.prepare("UPDATE modules SET name = ?, description = ? WHERE id = ?")
    .run(name.trim(), description ?? null, id);
  return findById(id);
}

function remove(id) {
  return db.prepare("DELETE FROM modules WHERE id = ?").run(id);
}

module.exports = { findAll, findById, create, update, remove };
