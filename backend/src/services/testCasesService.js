const { db } = require("../database/connection");

const BASE = `
  SELECT tc.*, m.name AS module_name, m.project_id,
    u.name AS assigned_to_name
  FROM test_cases tc
  JOIN modules m ON m.id = tc.module_id
  LEFT JOIN users u ON u.id = tc.assigned_to_id
`;

function findAll({ module_id, project_id, search } = {}) {
  const c = []; const p = [];
  if (module_id)  { c.push("tc.module_id = ?");  p.push(module_id); }
  if (project_id) { c.push("m.project_id = ?");  p.push(project_id); }
  if (search)     { c.push("LOWER(tc.title) LIKE ?"); p.push(`%${search.toLowerCase()}%`); }
  const w = c.length ? `WHERE ${c.join(" AND ")}` : "";
  return db.prepare(`${BASE} ${w} ORDER BY tc.id ASC`).all(...p);
}

function findById(id) { return db.prepare(`${BASE} WHERE tc.id=?`).get(id); }

function create({ module_id, title, description, preconditions, steps, expected_result, priority, assigned_to_id }) {
  const r = db.prepare(`
    INSERT INTO test_cases (module_id,title,description,preconditions,steps,expected_result,priority,assigned_to_id)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(module_id, title.trim(), description??null, preconditions??null,
         steps??null, expected_result??null, priority??"medium", assigned_to_id??null);
  return findById(r.lastInsertRowid);
}

function update(id, { module_id, title, description, preconditions, steps, expected_result, priority, assigned_to_id }) {
  db.prepare(`
    UPDATE test_cases SET module_id=?,title=?,description=?,preconditions=?,
    steps=?,expected_result=?,priority=?,assigned_to_id=? WHERE id=?
  `).run(module_id, title.trim(), description??null, preconditions??null,
         steps??null, expected_result??null, priority??"medium", assigned_to_id??null, id);
  return findById(id);
}

function remove(id) { return db.prepare("DELETE FROM test_cases WHERE id=?").run(id); }

module.exports = { findAll, findById, create, update, remove };
