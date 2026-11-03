import { query, USE_PG } from "../database/connection";

function cast(col: string): string {
  return USE_PG ? `${col}::int` : `CAST(${col} AS INTEGER)`;
}

export async function getDashboard({ project_id, cycle_id, date_from, date_to }: any = {}) {
  const num = (v: any) => parseInt(v || 0);
  const pid = project_id ? parseInt(project_id) : null;
  const noCycle = cycle_id === "no_cycle";
  const versionFilter = typeof cycle_id === "string" && cycle_id.startsWith("version:") ? cycle_id.replace("version:","") : null;
  const cid = (!noCycle && !versionFilter && cycle_id) ? parseInt(cycle_id) : null;
  
  // Se filtro por versão, buscar os IDs dos ciclos dessa versão
  let versionCycleIds: number[] = [];
  if (versionFilter && pid) {
    const vRows = await query<{id:number}>(`SELECT id FROM test_cycles WHERE project_id=$1 AND version=$2`, [pid, versionFilter]);
    versionCycleIds = vRows.map((r:any) => r.id);
  }
  const pWhere  = pid ? `AND c.project_id = ${pid}` : "";
  const pWhereM = pid ? `AND m.project_id = ${pid}` : "";
  const pWhereB = pid ? `AND b.project_id = ${pid}` : "";
  const vWhere = versionCycleIds.length > 0 ? `AND e.cycle_id IN (${versionCycleIds.join(",")})` : "AND 1=0";
  // Bugs por versão inclui bugs com version própria OU bugs de ciclos dessa versão
  const pWhereBV = versionFilter && pid ? `AND (b.version='${versionFilter}' OR b.id IN (SELECT DISTINCT bug_id FROM test_executions WHERE bug_id IS NOT NULL AND cycle_id IN (${versionCycleIds.join(",") || 0}))) AND b.project_id=${pid}` : pWhereB;
  const dWhereB = date_from && date_to
    ? `AND b.created_at >= '${date_from}' AND b.created_at <= '${date_to} 23:59:59'`
    : date_from ? `AND b.created_at >= '${date_from}'`
    : date_to   ? `AND b.created_at <= '${date_to} 23:59:59'` : "";


  const dWhereE = (!cid && date_from && date_to)
    ? `AND c.start_date >= '${date_from}' AND c.end_date <= '${date_to}'`
    : (!cid && date_from ? `AND c.start_date >= '${date_from}'`
    : (!cid && date_to   ? `AND c.end_date <= '${date_to}'` : ""));

  // Sem filtro de ciclo: considera só ciclos ativos
  const cWhereE  = cid ? `AND e.cycle_id = ${cid}` : versionFilter ? vWhere : `AND c.status = 'active'`;

  const execRows = await query<any>(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN e.status='passed' THEN 1 ELSE 0 END) AS passed,
    SUM(CASE WHEN e.status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN e.status='blocked' THEN 1 ELSE 0 END) AS blocked,
    SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_executions e JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${pWhere} ${cWhereE} ${dWhereE}`);
  const exec = execRows[0] || {};

  const tcRows = await query<{c: string}>(`SELECT COUNT(*) AS c FROM test_cases tc JOIN modules m ON m.id=tc.module_id WHERE 1=1 ${pWhereM}`);
  const totalCases = parseInt(tcRows[0]?.c || "0");

  let bugRows;
  if (cid) {
    bugRows = await query<any>(`SELECT COUNT(DISTINCT b.id) AS total,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed,
      SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed
      FROM test_executions e INNER JOIN bugs b ON b.id = e.bug_id
      WHERE e.cycle_id = ${cid} ${pWhereB}`);
  } else if (noCycle) {
    bugRows = await query<any>(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status='fixed' THEN 1 ELSE 0 END) AS fixed,
      SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed
      FROM bugs b WHERE 1=1 ${pWhereB} ${dWhereB}
      AND b.id NOT IN (SELECT DISTINCT bug_id FROM test_executions WHERE bug_id IS NOT NULL)`);
  } else {
    // Todos os ciclos: só bugs vinculados a ciclos ativos
    bugRows = await query<any>(`SELECT COUNT(DISTINCT b.id) AS total,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed,
      SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed
      FROM test_executions e
      JOIN test_cycles c ON c.id = e.cycle_id AND c.status = 'active'
      JOIN bugs b ON b.id = e.bug_id
      WHERE 1=1 ${pWhereB} ${dWhereB}`);
  }
  const bugs = bugRows[0] || {};

  const modRows = await query<any>(`SELECT m.id, m.name,
    COUNT(DISTINCT tc.id) AS total_cases,
    SUM(CASE WHEN e.status IN ('passed','failed','blocked') THEN 1 ELSE 0 END) AS total_executions,
    SUM(CASE WHEN e.status='passed' THEN 1 ELSE 0 END) AS passed,
    SUM(CASE WHEN e.status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN e.status='blocked' THEN 1 ELSE 0 END) AS blocked,
    SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM modules m LEFT JOIN test_cases tc ON tc.module_id = m.id
    LEFT JOIN test_executions e ON e.test_case_id = tc.id ${cid ? `AND e.cycle_id = ${cid}` : noCycle ? "AND 1=0" : "AND e.id IN (SELECT e2.id FROM test_executions e2 JOIN test_cycles c2 ON c2.id = e2.cycle_id WHERE c2.status = 'active')"}
    LEFT JOIN test_cycles c ON c.id = e.cycle_id
    WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_executions DESC`);

  let bpmRows;
  if (cid) {
    bpmRows = await query<any>(`SELECT m.id, m.name,
      COUNT(DISTINCT b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs
      FROM modules m LEFT JOIN bugs b ON b.module_id = m.id
        AND b.id IN (SELECT DISTINCT e2.bug_id FROM test_executions e2 WHERE e2.cycle_id = ${cid} AND e2.bug_id IS NOT NULL)
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC`);
  } else if (noCycle) {
    bpmRows = await query<any>(`SELECT m.id, m.name,
      (SELECT COUNT(*) FROM test_cases tc WHERE tc.module_id = m.id) AS total_cases,
      COUNT(DISTINCT b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs
      FROM modules m
      LEFT JOIN bugs b ON b.module_id = m.id
        AND b.id NOT IN (SELECT DISTINCT bug_id FROM test_executions WHERE bug_id IS NOT NULL)
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC`);
  } else {
    // Todos os ciclos: só bugs vinculados a ciclos ativos
    bpmRows = await query<any>(`SELECT m.id, m.name,
      COUNT(DISTINCT b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs
      FROM modules m
      LEFT JOIN bugs b ON b.module_id = m.id
        AND b.id IN (SELECT DISTINCT e2.bug_id FROM test_executions e2
          JOIN test_cycles c2 ON c2.id = e2.cycle_id AND c2.status = 'active'
          WHERE e2.bug_id IS NOT NULL)
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC`);
  }

  const bugsByCycleRows = await query<any>(`SELECT e.cycle_id,
    COUNT(DISTINCT b.id) AS total,
    SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open,
    SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
    SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed,
    SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed
    FROM test_executions e JOIN test_cycles c ON c.id = e.cycle_id INNER JOIN bugs b ON b.id = e.bug_id
    WHERE 1=1 ${pWhere} GROUP BY e.cycle_id`);
  const bugsByCycle: Record<number, any> = {};
  bugsByCycleRows.forEach((r: any) => {
    bugsByCycle[r.cycle_id] = { total: num(r.total), open: num(r.open), in_progress: num(r.in_progress), fixed: num(r.fixed), closed: num(r.closed) };
  });

  const cycleRows = await query<any>(`SELECT c.*,
    COUNT(e.id) AS total_executions,
    SUM(CASE WHEN e.status='passed' THEN 1 ELSE 0 END) AS passed,
    SUM(CASE WHEN e.status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN e.status='blocked' THEN 1 ELSE 0 END) AS blocked,
    SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE 1=1 ${pWhere} GROUP BY c.id ORDER BY c.created_at DESC`);

  const total   = num(exec.total);
  const passed  = num(exec.passed);
  const failed  = num(exec.failed);
  const blocked = num(exec.blocked);
  const notExec = num(exec.not_executed);
  const executed = total - notExec;
  const rate = (n: number) => executed > 0 ? +((n/executed)*100).toFixed(1) : 0;

  // Bugs por ambiente (usando environment_id para ambientes customizados)
  const dWhereBug = dWhereB ? dWhereB.replace('AND b.created_at', 'AND b.created_at') : '';
  const envRows = await query<any>(`SELECT
    pe.id, pe.name AS environment, pe.color,
    COUNT(b.id) AS total,
    SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open
    FROM project_environments pe
    LEFT JOIN bugs b ON b.environment_id = pe.id ${dWhereBug}
    WHERE pe.project_id = $1
    GROUP BY pe.id, pe.name, pe.color, pe.sort_order
    HAVING COUNT(b.id) > 0
    ORDER BY pe.sort_order`, [pid || 0]);
  const bugs_by_environment = envRows.map((r: any) => ({
    id: r.id,
    environment: r.environment,
    color: r.color,
    total: num(r.total),
    open: num(r.open),
  }));

  return {
    summary: { total_cases: totalCases, total_executions: total, passed, failed, blocked, not_executed: notExec,
      success_rate: rate(passed), fail_rate: rate(failed), block_rate: rate(blocked) },
    bugs: { total: num(bugs.total), open: num(bugs.open), in_progress: num(bugs.in_progress), fixed: num(bugs.fixed), closed: num(bugs.closed) },
    modules:         modRows.map((m: any) => ({...m, total_cases:num(m.total_cases), total_executions:num(m.total_executions), passed:num(m.passed), failed:num(m.failed), blocked:num(m.blocked), not_executed:num(m.not_executed)})),
    bugs_per_module: bpmRows.map((m: any) => ({...m, total_cases:num(m.total_cases), total_bugs:num(m.total_bugs), open_bugs:num(m.open_bugs), fixed_bugs:num(m.fixed_bugs)})),
    cycles: cycleRows.map((c: any) => ({...c, total_executions:num(c.total_executions), passed:num(c.passed), failed:num(c.failed), blocked:num(c.blocked), not_executed:num(c.not_executed), bugs: bugsByCycle[c.id] || {total:0,open:0,in_progress:0,fixed:0,closed:0}})),
    bugs_by_environment,
    all_bugs_versions: pid ? await query(`SELECT id, version, status FROM bugs WHERE project_id=$1 AND version IS NOT NULL AND version != ''`, [pid]) : [],
  };
}