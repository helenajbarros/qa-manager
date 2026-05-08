const { query, execute } = require("../database/connection");

const BASE = `
  SELECT tc.*, m.name AS module_name, m.project_id, u.name AS assigned_to_name
  FROM test_cases tc
  JOIN modules m ON m.id = tc.module_id
  LEFT JOIN users u ON u.id = tc.assigned_to_id
`;

async function findAll({ module_id, project_id, search } = {}) {
  const conds = ["1=1"]; const params = [];
  if (module_id)  { params.push(module_id);  conds.push(`tc.module_id = $${params.length}`); }
  if (project_id) { params.push(project_id); conds.push(`m.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(tc.title) LIKE $${params.length}`); }
  return query(`${BASE} WHERE ${conds.join(" AND ")} ORDER BY tc.id ASC`, params);
}

async function findById(id) {
  const rows = await query(`${BASE} WHERE tc.id=$1`, [id]);
  return rows[0];
}

async function create({ module_id, title, description, preconditions, steps, expected_result, priority, assigned_to_id }) {
  const rows = await query(
    "INSERT INTO test_cases (module_id,title,description,preconditions,steps,expected_result,priority,assigned_to_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [module_id||null, title.trim(), description||null, preconditions||null, steps||null, expected_result||null, priority||"medium", assigned_to_id||null]
  );
  return findById(rows[0].id);
}

async function update(id, { module_id, title, description, preconditions, steps, expected_result, priority, assigned_to_id }) {
  await execute(
    "UPDATE test_cases SET module_id=$1,title=$2,description=$3,preconditions=$4,steps=$5,expected_result=$6,priority=$7,assigned_to_id=$8 WHERE id=$9",
    [module_id||null, title.trim(), description||null, preconditions||null, steps||null, expected_result||null, priority||"medium", assigned_to_id||null, id]
  );
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM test_cases WHERE id=$1", [id]);
}

module.exports = { findAll, findById, create, update, remove };