const { query, USE_PG } = require("../database/connection");

function cast(col) {
  return USE_PG ? `${col}::int` : `CAST(${col} AS INTEGER)`;
}

async function getDashboard({ project_id, cycle_id } = {}) {
  const num = v => parseInt(v || 0);
  const pid  = project_id ? parseInt(project_id) : null;
  const cid  = cycle_id   ? parseInt(cycle_id)   : null;

  const pWhere  = pid ? `AND c.project_id = ${pid}` : "";
  const pWhereM = pid ? `AND m.project_id = ${pid}` : "";
  const pWhereB = pid ? `AND b.project_id = ${pid}` : "";

  // Quando ciclo específico: filtra execuções, módulos e bugs pelo ciclo
  const cWhereE  = cid ? `AND e.cycle_id = ${cid}` : "";
  const cWhereCy = cid ? `AND c.id = ${cid}` : "";

  // ── Execuções ────────────────────────────────────────────────
  const execRows = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_executions e
    JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${pWhere} ${cWhereE}
  `);
  const exec = execRows[0] || {};

  // ── Total de casos ───────────────────────────────────────────
  const tcRows = await query(`SELECT COUNT(*) AS c FROM test_cases tc JOIN modules m ON m.id=tc.module_id WHERE 1=1 ${pWhereM}`);
  const totalCases = parseInt(tcRows[0]?.c || 0);

  // ── Bugs ─────────────────────────────────────────────────────
  // Quando ciclo específico: conta bugs vinculados às execuções do ciclo
  // Quando sem filtro: conta todos os bugs do projeto
  let bugRows;
  if (cid) {
    bugRows = await query(`
      SELECT COUNT(DISTINCT b.id) AS total,
        SUM(CASE WHEN b.status='open'        THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN b.status='fixed'       THEN 1 ELSE 0 END) AS fixed,
        SUM(CASE WHEN b.status='closed'      THEN 1 ELSE 0 END) AS closed
      FROM test_executions e
      INNER JOIN bugs b ON b.id = e.bug_id
      WHERE e.cycle_id = ${cid} ${pWhereB.replace('b.project_id','b.project_id')}
    `);
  } else {
    bugRows = await query(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status='open'        THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status='fixed'       THEN 1 ELSE 0 END) AS fixed,
        SUM(CASE WHEN status='closed'      THEN 1 ELSE 0 END) AS closed
      FROM bugs b WHERE 1=1 ${pWhereB}
    `);
  }
  const bugs = bugRows[0] || {};

  // ── Métricas por módulo ──────────────────────────────────────
  const modRows = await query(`
    SELECT m.id, m.name,
      COUNT(DISTINCT tc.id) AS total_cases,
      COUNT(e.id)           AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM modules m
    LEFT JOIN test_cases tc ON tc.module_id = m.id
    LEFT JOIN test_executions e ON e.test_case_id = tc.id ${cid ? `AND e.cycle_id = ${cid}` : ""}
    LEFT JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_executions DESC
  `);

  // ── Bugs por módulo ──────────────────────────────────────────
  let bpmRows;
  if (cid) {
    // Quando ciclo: bugs vinculados às execuções do ciclo agrupados por módulo
    bpmRows = await query(`
      SELECT m.id, m.name,
        COUNT(DISTINCT b.id) AS total_bugs,
        SUM(CASE WHEN b.status='open'  THEN 1 ELSE 0 END) AS open_bugs,
        SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs
      FROM modules m
      LEFT JOIN bugs b ON b.module_id = m.id
        AND b.id IN (
          SELECT DISTINCT e2.bug_id FROM test_executions e2
          WHERE e2.cycle_id = ${cid} AND e2.bug_id IS NOT NULL
        )
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC
    `);
  } else {
    bpmRows = await query(`
      SELECT m.id, m.name,
        COUNT(b.id) AS total_bugs,
        SUM(CASE WHEN b.status='open'  THEN 1 ELSE 0 END) AS open_bugs,
        SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs
      FROM modules m LEFT JOIN bugs b ON b.module_id = m.id
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC
    `);
  }

  // ── Bugs por ciclo (para cards de ciclo) ─────────────────────
  const bugsByCycleRows = await query(`
    SELECT
      e.cycle_id,
      COUNT(DISTINCT b.id) AS total,
      SUM(CASE WHEN b.status='open'        THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN b.status='fixed'       THEN 1 ELSE 0 END) AS fixed,
      SUM(CASE WHEN b.status='closed'      THEN 1 ELSE 0 END) AS closed
    FROM test_executions e
    JOIN test_cycles c ON c.id = e.cycle_id
    INNER JOIN bugs b ON b.id = e.bug_id
    WHERE 1=1 ${pWhere}
    GROUP BY e.cycle_id
  `);
  const bugsByCycle = {};
  bugsByCycleRows.forEach(r => {
    bugsByCycle[r.cycle_id] = {
      total: num(r.total), open: num(r.open),
      in_progress: num(r.in_progress), fixed: num(r.fixed), closed: num(r.closed)
    };
  });

  // ── Ciclos ───────────────────────────────────────────────────
  const cycleRows = await query(`
    SELECT c.*,
      COUNT(e.id) AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE 1=1 ${pWhere} GROUP BY c.id ORDER BY c.created_at DESC
  `);

  const total    = num(exec.total);
  const passed   = num(exec.passed);
  const failed   = num(exec.failed);
  const blocked  = num(exec.blocked);
  const notExec  = num(exec.not_executed);
  const executed = total - notExec;
  const rate = (n) => executed > 0 ? +((n/executed)*100).toFixed(1) : 0;

  return {
    summary: {
      total_cases: totalCases, total_executions: total,
      passed, failed, blocked, not_executed: notExec,
      success_rate: rate(passed), fail_rate: rate(failed), block_rate: rate(blocked),
    },
    bugs: {
      total: num(bugs.total), open: num(bugs.open), in_progress: num(bugs.in_progress),
      fixed: num(bugs.fixed), closed: num(bugs.closed),
    },
    modules:         modRows.map(m=>({...m, total_cases:num(m.total_cases), total_executions:num(m.total_executions), passed:num(m.passed), failed:num(m.failed), blocked:num(m.blocked), not_executed:num(m.not_executed)})),
    bugs_per_module: bpmRows.map(m=>({...m, total_bugs:num(m.total_bugs), open_bugs:num(m.open_bugs), fixed_bugs:num(m.fixed_bugs)})),
    cycles: cycleRows.map(c=>({
      ...c,
      total_executions: num(c.total_executions),
      passed:  num(c.passed), failed:  num(c.failed),
      blocked: num(c.blocked), not_executed: num(c.not_executed),
      bugs: bugsByCycle[c.id] || { total:0, open:0, in_progress:0, fixed:0, closed:0 },
    })),
  };
}

module.exports = { getDashboard };
