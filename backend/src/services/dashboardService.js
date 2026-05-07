const { pool } = require("../database/connection");

async function getDashboard({ project_id } = {}) {
  const pWhere  = project_id ? `AND c.project_id = ${parseInt(project_id)}` : "";
  const pWhereM = project_id ? `AND m.project_id = ${parseInt(project_id)}` : "";
  const pWhereB = project_id ? `AND b.project_id = ${parseInt(project_id)}` : "";

  const execRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END)::int AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END)::int AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END)::int AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END)::int AS not_executed
    FROM test_executions e
    JOIN test_cycles c ON c.id = e.cycle_id WHERE 1=1 ${pWhere}
  `);
  const exec = execRes.rows[0];

  const tcRes = await pool.query(`SELECT COUNT(*)::int AS c FROM test_cases tc JOIN modules m ON m.id=tc.module_id WHERE 1=1 ${pWhereM}`);
  const totalCases = tcRes.rows[0].c;

  const bugsRes = await pool.query(`
    SELECT COUNT(*)::int AS total,
      SUM(CASE WHEN status='open'        THEN 1 ELSE 0 END)::int AS open,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END)::int AS in_progress,
      SUM(CASE WHEN status='fixed'       THEN 1 ELSE 0 END)::int AS fixed,
      SUM(CASE WHEN status='closed'      THEN 1 ELSE 0 END)::int AS closed
    FROM bugs b WHERE 1=1 ${pWhereB}
  `);
  const bugs = bugsRes.rows[0];

  const modRes = await pool.query(`
    SELECT m.id, m.name,
      COUNT(DISTINCT tc.id)::int AS total_cases,
      COUNT(e.id)::int           AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END)::int AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END)::int AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END)::int AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END)::int AS not_executed
    FROM modules m
    LEFT JOIN test_cases tc ON tc.module_id = m.id
    LEFT JOIN test_executions e ON e.test_case_id = tc.id
    LEFT JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_executions DESC
  `);

  const bpmRes = await pool.query(`
    SELECT m.id, m.name,
      COUNT(b.id)::int AS total_bugs,
      SUM(CASE WHEN b.status='open'  THEN 1 ELSE 0 END)::int AS open_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END)::int AS fixed_bugs
    FROM modules m LEFT JOIN bugs b ON b.module_id = m.id
    WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC
  `);

  const cyclesRes = await pool.query(`
    SELECT c.*,
      COUNT(e.id)::int AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END)::int AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END)::int AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END)::int AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END)::int AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE 1=1 ${pWhere} GROUP BY c.id ORDER BY c.created_at DESC
  `);

  const executed = exec.total - exec.not_executed;
  const rate = (n) => executed > 0 ? +((n/executed)*100).toFixed(1) : 0;

  return {
    summary: {
      total_cases: totalCases,
      total_executions: exec.total,
      passed: exec.passed, failed: exec.failed,
      blocked: exec.blocked, not_executed: exec.not_executed,
      success_rate: rate(exec.passed),
      fail_rate:    rate(exec.failed),
      block_rate:   rate(exec.blocked),
    },
    bugs,
    modules:        modRes.rows,
    bugs_per_module: bpmRes.rows,
    cycles:         cyclesRes.rows,
  };
}

module.exports = { getDashboard };
