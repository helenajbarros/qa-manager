const { query, execute } = require("../database/connection");

async function findAll({ project_id, search } = {}) {
  const conds = ["1=1"]; const params = [];
  if (project_id) { params.push(project_id); conds.push(`m.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(m.name) LIKE $${params.length}`); }
  return query(`
    SELECT m.*, COUNT(tc.id) AS test_count
    FROM modules m LEFT JOIN test_cases tc ON tc.module_id = m.id
    WHERE ${conds.join(" AND ")} GROUP BY m.id ORDER BY m.name
  `, params);
}

async function findById(id) {
  const rows = await query("SELECT * FROM modules WHERE id = $1", [id]);
  return rows[0];
}

async function create({ name, description, project_id }) {
  const rows = await query("INSERT INTO modules (name,description,project_id) VALUES ($1,$2,$3) RETURNING id",
    [name.trim(), description??null, project_id??1]);
  return findById(rows[0].id);
}

async function update(id, { name, description }) {
  await execute("UPDATE modules SET name=$1, description=$2 WHERE id=$3", [name.trim(), description??null, id]);
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM modules WHERE id=$1", [id]);
}

module.exports = { findAll, findById, create, update, remove };
