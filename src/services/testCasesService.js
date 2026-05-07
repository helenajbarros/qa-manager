const { db } = require("../database/connection");

const WITH_MODULE = `
  SELECT tc.*, m.name AS module_name
  FROM test_cases tc
  JOIN modules m ON m.id = tc.module_id
`;

function findAll({ module_id } = {}) {
  if (module_id) {
    return db.prepare(`${WITH_MODULE} WHERE tc.module_id = ? ORDER BY tc.title`).all(module_id);
  }
  return db.prepare(`${WITH_MODULE} ORDER BY m.name, tc.title`).all();
}

function findById(id) {
  return db.prepare(`${WITH_MODULE} WHERE tc.id = ?`).get(id);
}

function create({ module_id, title, description, preconditions, steps, expected_result, priority }) {
  const result = db.prepare(`
    INSERT INTO test_cases
      (module_id, title, description, preconditions, steps, expected_result, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    module_id,
    title.trim(),
    description    ?? null,
    preconditions  ?? null,
    steps          ?? null,
    expected_result ?? null,
    priority       ?? "medium"
  );
  return findById(result.lastInsertRowid);
}

function update(id, { module_id, title, description, preconditions, steps, expected_result, priority }) {
  db.prepare(`
    UPDATE test_cases
    SET module_id = ?, title = ?, description = ?, preconditions = ?,
        steps = ?, expected_result = ?, priority = ?
    WHERE id = ?
  `).run(
    module_id,
    title.trim(),
    description     ?? null,
    preconditions   ?? null,
    steps           ?? null,
    expected_result ?? null,
    priority        ?? "medium",
    id
  );
  return findById(id);
}

function remove(id) {
  return db.prepare("DELETE FROM test_cases WHERE id = ?").run(id);
}

module.exports = { findAll, findById, create, update, remove };
