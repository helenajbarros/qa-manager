const { db } = require("../database/connection");

function getDashboard({ project_id } = {}) {
  const pWhere = project_id ? `AND c.project_id = ${project_id}` : "";
  const bWhere = project_id ? `AND b.project_id = ${project_id}` : "";
  const mWhere = project_id ? `AND m.project_id = ${project_id}` : "";

  const exec = db.prepare(`
    SELECT
      COUNT(*)  AS total,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_executions e
    JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${pWhere}
  `).get();

  const totalCases = db.prepare(`
    SELECT COUNT(*) AS c FROM test_cases tc
    JOIN modules m ON m.id = tc.module_id WHERE 1=1 ${mWhere}
  `).get().c;

  const bugs = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='open'        THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status='fixed'       THEN 1 ELSE 0 END) AS fixed,
      SUM(CASE WHEN status='closed'      THEN 1 ELSE 0 END) AS closed
    FROM bugs b WHERE 1=1 ${bWhere}
  `).get();

  const moduleStats = db.prepare(`
    SELECT m.id, m.name,
      COUNT(DISTINCT tc.id) AS total_cases,
      COUNT(e.id)           AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM modules m
    LEFT JOIN test_cases tc ON tc.module_id = m.id
    LEFT JOIN test_executions e ON e.test_case_id = tc.id
    LEFT JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${mWhere}
    GROUP BY m.id ORDER BY total_executions DESC
  `).all();

  const bugsPerModule = db.prepare(`
    SELECT m.id, m.name,
      COUNT(b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open'  THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs
    FROM modules m LEFT JOIN bugs b ON b.module_id = m.id
    WHERE 1=1 ${mWhere}
    GROUP BY m.id ORDER BY total_bugs DESC
  `).all();

  // Todos os ciclos com métricas detalhadas (não só 5)
  const cycles = db.prepare(`
    SELECT c.*,
      COUNT(e.id) AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE 1=1 ${pWhere}
    GROUP BY c.id ORDER BY c.created_at DESC
  `).all();

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
    modules: moduleStats,
    bugs_per_module: bugsPerModule,
    cycles,
  };
}

module.exports = { getDashboard };
