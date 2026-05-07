const { pool } = require("../database/connection");

async function findAllCycles({ project_id, search } = {}) {
  const conds = ["1=1"]; const params = [];
  if (project_id) { params.push(project_id); conds.push(`c.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(c.name) LIKE $${params.length}`); }
  const res = await pool.query(`
    SELECT c.*,
      COUNT(e.id)::int AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END)::int AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END)::int AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END)::int AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END)::int AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE ${conds.join(" AND ")} GROUP BY c.id ORDER BY c.created_at DESC
  `, params);
  return res.rows;
}

async function findCycleById(id) {
  const res = await pool.query("SELECT * FROM test_cycles WHERE id=$1", [id]);
  return res.rows[0];
}

async function createCycle({ name, description, version, test_types, start_date, end_date, project_id }) {
  const types = Array.isArray(test_types) ? test_types.join(",") : (test_types ?? null);
  const res = await pool.query(`
    INSERT INTO test_cycles (name,description,version,test_types,start_date,end_date,project_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [name.trim(), description??null, version??null, types, start_date??null, end_date??null, project_id??1]);
  return findCycleById(res.rows[0].id);
}

async function updateCycle(id, { name, description, version, test_types, start_date, end_date, status }) {
  const types = Array.isArray(test_types) ? test_types.join(",") : (test_types ?? null);
  await pool.query(`
    UPDATE test_cycles SET name=$1,description=$2,version=$3,test_types=$4,start_date=$5,end_date=$6,status=$7
    WHERE id=$8
  `, [name.trim(), description??null, version??null, types, start_date??null, end_date??null, status??"active", id]);
  return findCycleById(id);
}

async function removeCycle(id) {
  const res = await pool.query("DELETE FROM test_cycles WHERE id=$1", [id]);
  return { changes: res.rowCount };
}

const EXEC_Q = `
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
  const files = await pool.query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1 ORDER BY created_at", [e.id]);
  return { ...e, evidence_files: files.rows };
}

async function findExecutionsByCycle(cycle_id) {
  const res = await pool.query(`${EXEC_Q} WHERE e.cycle_id=$1 ORDER BY m.name, tc.id`, [cycle_id]);
  return Promise.all(res.rows.map(parseExec));
}

async function findExecutionById(id) {
  const res = await pool.query(`${EXEC_Q} WHERE e.id=$1`, [id]);
  return res.rows[0] ? parseExec(res.rows[0]) : undefined;
}

async function addExecutions(cycle_id, test_case_ids) {
  for (const id of test_case_ids) {
    await pool.query(
      "INSERT INTO test_executions (cycle_id,test_case_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [cycle_id, id]
    );
  }
  return test_case_ids.length;
}

async function updateExecution(id, { status, evidence_url, comment, bug_id, notes, executed_by_id, assigned_to_id }) {
  await pool.query(`
    UPDATE test_executions
    SET status=$1, evidence_url=$2, comment=$3, bug_id=$4, notes=$5,
        executed_by_id=$6, assigned_to_id=$7,
        executed_at = CASE WHEN $1 != 'not_executed' THEN NOW() ELSE executed_at END
    WHERE id=$8
  `, [status??"not_executed", evidence_url??null, comment??null, bug_id??null, notes??null, executed_by_id??null, assigned_to_id??null, id]);
  return findExecutionById(id);
}

async function addEvidenceFile(execution_id, { filename, originalname, mimetype, size }) {
  await pool.query("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('execution',$1,$2,$3,$4,$5)",
    [execution_id, filename, originalname, mimetype, size]);
  const res = await pool.query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1", [execution_id]);
  return res.rows;
}

async function removeEvidenceFile(execution_id, file_id) {
  await pool.query("DELETE FROM evidence_files WHERE id=$1 AND ref_type='execution' AND ref_id=$2", [file_id, execution_id]);
  const res = await pool.query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1", [execution_id]);
  return res.rows;
}

async function removeExecution(id) {
  const res = await pool.query("DELETE FROM test_executions WHERE id=$1", [id]);
  return { changes: res.rowCount };
}

module.exports = {
  findAllCycles, findCycleById, createCycle, updateCycle, removeCycle,
  findExecutionsByCycle, findExecutionById, addExecutions, updateExecution,
  addEvidenceFile, removeEvidenceFile, removeExecution,
};
