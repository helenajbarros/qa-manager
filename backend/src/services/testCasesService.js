const { query, execute } = require("../database/connection");

async function logActivity(test_case_id, user_id, action, detail) {
  try {
    await query(
      "INSERT INTO test_case_activity (test_case_id, user_id, action, detail) VALUES ($1,$2,$3,$4)",
      [test_case_id, user_id || null, action, detail || null]
    );
  } catch(_) {}
}

async function getActivity(test_case_id) {
  return query(`
    SELECT ta.*, u.name AS user_name
    FROM test_case_activity ta
    LEFT JOIN users u ON u.id = ta.user_id
    WHERE ta.test_case_id = $1
    ORDER BY ta.created_at ASC
  `, [test_case_id]);
}

const BASE = `
  SELECT tc.*, m.name AS module_name, m.project_id, u.name AS assigned_to_name
  FROM test_cases tc
  JOIN modules m ON m.id = tc.module_id
  LEFT JOIN users u ON u.id = tc.assigned_to_id
`;

async function findAll({ module_id, project_id, search, page, limit } = {}) {
  const conds = ["1=1"]; const params = [];
  if (module_id)  { params.push(module_id);  conds.push(`tc.module_id = $${params.length}`); }
  if (project_id) { params.push(project_id); conds.push(`m.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(tc.title) LIKE $${params.length}`); }

  const where = conds.join(" AND ");

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(limit) || 100));
  const offset   = (pageNum - 1) * pageSize;

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM test_cases tc JOIN modules m ON m.id = tc.module_id WHERE ${where}`,
    params
  );
  const total = parseInt(countRows[0]?.total || 0);

  params.push(pageSize); const limitIdx  = params.length;
  params.push(offset);   const offsetIdx = params.length;
  const data = await query(
    `${BASE} WHERE ${where} ORDER BY tc.id ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return { data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
}

async function findById(id) {
  const rows = await query(`${BASE} WHERE tc.id=$1`, [id]);
  return rows[0];
}

async function create({ module_id, title, description, preconditions, steps, expected_result, priority, assigned_to_id }, userId) {
  const rows = await query(
    "INSERT INTO test_cases (module_id,title,description,preconditions,steps,expected_result,priority,assigned_to_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [module_id||null, title.trim(), description||null, preconditions||null, steps||null, expected_result||null, priority||"medium", assigned_to_id||null]
  );
  const tc = await findById(rows[0].id);
  await logActivity(rows[0].id, userId || null, "criou o caso de teste", null);
  return tc;
}

async function update(id, { module_id, title, description, preconditions, steps, expected_result, priority, assigned_to_id }, userId) {
  const prev = await findById(id);
  await execute(
    "UPDATE test_cases SET module_id=$1,title=$2,description=$3,preconditions=$4,steps=$5,expected_result=$6,priority=$7,assigned_to_id=$8 WHERE id=$9",
    [module_id||null, title.trim(), description||null, preconditions||null, steps||null, expected_result||null, priority||"medium", assigned_to_id||null, id]
  );
  if (prev) {
    if (prev.title !== title.trim()) await logActivity(id, userId, "editou o título", `"${prev.title}" → "${title.trim()}"`);
    if (String(prev.module_id) !== String(module_id)) await logActivity(id, userId, "alterou o módulo", null);
    if (prev.priority !== (priority||"medium")) await logActivity(id, userId, "alterou a prioridade", `${prev.priority} → ${priority||"medium"}`);
    if (String(prev.assigned_to_id||"") !== String(assigned_to_id||"")) await logActivity(id, userId, "alterou o responsável", null);
  }
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM test_cases WHERE id=$1", [id]);
}

module.exports = { findAll, findById, create, update, remove, logActivity, getActivity };