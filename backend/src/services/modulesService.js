const { pool } = require("../database/connection");

async function findAll({ project_id, search } = {}) {
  const conds = ["1=1"]; const params = [];
  if (project_id) { params.push(project_id); conds.push(`m.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(m.name) LIKE $${params.length}`); }
  const res = await pool.query(`
    SELECT m.*, COUNT(tc.id)::int AS test_count
    FROM modules m LEFT JOIN test_cases tc ON tc.module_id = m.id
    WHERE ${conds.join(" AND ")} GROUP BY m.id ORDER BY m.name
  `, params);
  return res.rows;
}

async function findById(id) {
  const res = await pool.query("SELECT * FROM modules WHERE id = $1", [id]);
  return res.rows[0];
}

async function create({ name, description, project_id }) {
  const res = await pool.query(
    "INSERT INTO modules (name,description,project_id) VALUES ($1,$2,$3) RETURNING *",
    [name.trim(), description ?? null, project_id ?? 1]
  );
  return res.rows[0];
}

async function update(id, { name, description }) {
  const res = await pool.query(
    "UPDATE modules SET name=$1, description=$2 WHERE id=$3 RETURNING *",
    [name.trim(), description ?? null, id]
  );
  return res.rows[0];
}

async function remove(id) {
  const res = await pool.query("DELETE FROM modules WHERE id=$1", [id]);
  return { changes: res.rowCount };
}

module.exports = { findAll, findById, create, update, remove };
