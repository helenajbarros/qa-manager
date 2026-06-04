const { query, execute } = require("../database/connection");

async function logActivity(cycle_id, user_id, action, detail) {
  try {
    await query(
      "INSERT INTO cycle_activity (cycle_id, user_id, action, detail) VALUES ($1,$2,$3,$4)",
      [cycle_id, user_id || null, action, detail || null]
    );
  } catch(_) {}
}

async function getActivity(cycle_id) {
  return query(`
    SELECT ca.*, u.name AS user_name
    FROM cycle_activity ca
    LEFT JOIN users u ON u.id = ca.user_id
    WHERE ca.cycle_id = $1
    ORDER BY ca.created_at ASC
  `, [cycle_id]);
}

async function findAllCycles({ project_id, search, page, limit } = {}) {
  const conds = ["1=1"]; const params = [];
  if (project_id) { params.push(project_id); conds.push(`c.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(c.name) LIKE $${params.length}`); }

  const where = conds.join(" AND ");

  const pageNum  = Math.max(1, parseInt(page)  || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset   = (pageNum - 1) * pageSize;

  const countRows = await query(`SELECT COUNT(*) AS total FROM test_cycles c WHERE ${where}`, params);
  const total = parseInt(countRows[0]?.total || 0);

  params.push(pageSize); const limitIdx  = params.length;
  params.push(offset);   const offsetIdx = params.length;
  const rows = await query(`
    SELECT c.*,
      COUNT(e.id) AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE ${where} GROUP BY c.id ORDER BY c.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `, params);
  const data = rows.map(r => ({...r, total_executions:parseInt(r.total_executions||0), passed:parseInt(r.passed||0), failed:parseInt(r.failed||0), blocked:parseInt(r.blocked||0), not_executed:parseInt(r.not_executed||0)}));
  return { data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
}

async function findCycleById(id) {
  const rows = await query("SELECT * FROM test_cycles WHERE id=$1", [id]);
  return rows[0];
}

async function createCycle({ name, description, version, test_types, start_date, end_date, project_id }) {
  const types = Array.isArray(test_types) ? test_types.join(",") : (test_types||null);
  const rows = await query(
    "INSERT INTO test_cycles (name,description,version,test_types,start_date,end_date,project_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [name.trim(), description||null, version||null, types, start_date||null, end_date||null, project_id||1]
  );
  const cycle = await findCycleById(rows[0].id);
  await logActivity(rows[0].id, null, "criou o ciclo", null);
  return cycle;
}

async function updateCycle(id, { name, description, version, test_types, start_date, end_date, status }, userId) {
  const prev  = await findCycleById(id);
  const types = Array.isArray(test_types) ? test_types.join(",") : (test_types||null);
  await execute(
    "UPDATE test_cycles SET name=$1,description=$2,version=$3,test_types=$4,start_date=$5,end_date=$6,status=$7 WHERE id=$8",
    [name.trim(), description||null, version||null, types, start_date||null, end_date||null, status||"active", id]
  );
  if (prev) {
    if (prev.name !== name.trim()) await logActivity(id, userId, "editou o nome", `"${prev.name}" → "${name.trim()}"`);
    if ((prev.status||"active") !== (status||"active")) await logActivity(id, userId, "alterou o status", `${prev.status} → ${status}`);
    if ((prev.version||"") !== (version||"")) await logActivity(id, userId, "alterou a versão", `${prev.version||"-"} → ${version||"-"}`);
  }
  return findCycleById(id);
}

async function removeCycle(id) {
  return execute("DELETE FROM test_cycles WHERE id=$1", [id]);
}

const EXEC_BASE = `
  SELECT e.*,
    tc.title AS test_case_title, tc.priority,
    tc.description AS test_case_description,
    tc.steps, tc.expected_result, tc.preconditions,
    m.name AS module_name, m.id AS module_id,
    b.title AS bug_title,
    eu.name AS executed_by_name,
    au.name AS assigned_to_name
  FROM test_executions e
  JOIN test_cases tc ON tc.id = e.test_case_id
  JOIN modules    m  ON m.id  = tc.module_id
  LEFT JOIN bugs  b  ON b.id  = e.bug_id
  LEFT JOIN users eu ON eu.id = e.executed_by_id
  LEFT JOIN users au ON au.id = e.assigned_to_id
`;

async function parseExec(e) {
  const files = await query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1 ORDER BY created_at", [e.id]);
  return { ...e, evidence_files: files };
}

async function findExecutionsByCycle(cycle_id) {
  const rows = await query(`${EXEC_BASE} WHERE e.cycle_id=$1 ORDER BY m.name, tc.id`, [cycle_id]);
  return Promise.all(rows.map(parseExec));
}

async function findExecutionById(id) {
  const rows = await query(`${EXEC_BASE} WHERE e.id=$1`, [id]);
  return rows[0] ? parseExec(rows[0]) : undefined;
}

async function addExecutions(cycle_id, test_case_ids) {
  for (const id of test_case_ids) {
    try {
      await query("INSERT INTO test_executions (cycle_id,test_case_id) VALUES ($1,$2) RETURNING id", [cycle_id, id]);
    } catch(_) {}
  }
  return test_case_ids.length;
}

async function updateExecution(id, { status, evidence_url, comment, bug_id, notes, executed_by_id, assigned_to_id }) {
  await execute(
    "UPDATE test_executions SET status=$1,evidence_url=$2,comment=$3,bug_id=$4,notes=$5,executed_by_id=$6,assigned_to_id=$7 WHERE id=$8",
    [status||"not_executed", evidence_url||null, comment||null, bug_id||null, notes||null, executed_by_id||null, assigned_to_id||null, id]
  );
  return findExecutionById(id);
}

async function addEvidenceFile(execution_id, { filename, originalname, mimetype, size }) {
  await execute("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('execution',$1,$2,$3,$4,$5)",
    [execution_id, filename, originalname, mimetype, size]);
  return query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1", [execution_id]);
}

async function removeEvidenceFile(execution_id, file_id) {
  await execute("DELETE FROM evidence_files WHERE id=$1 AND ref_type='execution' AND ref_id=$2", [file_id, execution_id]);
  return query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1", [execution_id]);
}

async function removeExecution(id) {
  return execute("DELETE FROM test_executions WHERE id=$1", [id]);
}

module.exports = {
  findAllCycles, findCycleById, createCycle, updateCycle, removeCycle,
  findExecutionsByCycle, findExecutionById, addExecutions, updateExecution,
  addEvidenceFile, deleteEvidenceFile,
  logActivity, getActivity,
};