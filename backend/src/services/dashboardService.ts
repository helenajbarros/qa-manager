import { query, USE_PG } from "../database/connection";

function cast(col: string): string {
  return USE_PG ? `${col}::int` : `CAST(${col} AS INTEGER)`;
}

type ExecRow = { test_case_id: number; module_id: number; status: string; executed_at?: any; created_at?: any; id: number };

function ts(v: any): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Estatística por CASO (não por linha de execução).
 * Um caso executado em 3 ciclos conta UMA vez, com o resultado mais recente.
 * Assim: passou + falhou + bloqueado + não executado = casos considerados (nunca passa dos casos cadastrados).
 * `universe` = ids dos casos considerados; `execs` = execuções dentro do filtro atual.
 */
export function computeCaseStats(universe: Map<number, number>, execs: ExecRow[]) {
  const latest = new Map<number, ExecRow>();
  for (const e of execs) {
    if (e.status === "not_executed" || !e.status) continue;
    if (!universe.has(e.test_case_id)) continue;
    const cur = latest.get(e.test_case_id);
    const a = ts(e.executed_at) || ts(e.created_at), b = cur ? (ts(cur.executed_at) || ts(cur.created_at)) : -1;
    if (!cur || a > b || (a === b && e.id > cur.id)) latest.set(e.test_case_id, e);
  }
  const total = { total: universe.size, passed: 0, failed: 0, blocked: 0, not_executed: 0 };
  const byModule = new Map<number, { total: number; passed: number; failed: number; blocked: number; not_executed: number }>();
  const slot = (m: number) => byModule.get(m) || byModule.set(m, { total: 0, passed: 0, failed: 0, blocked: 0, not_executed: 0 }).get(m)!;
  universe.forEach((moduleId, caseId) => {
    const st = latest.get(caseId)?.status;
    const key = st === "passed" || st === "failed" || st === "blocked" ? st : "not_executed";
    (total as any)[key]++;
    const m = slot(moduleId); m.total++; (m as any)[key]++;
  });
  return { total, byModule };
}

export async function getDashboard({ project_id, cycle_id, date_from, date_to }: any = {}) {
  const num = (v: any) => parseInt(v || 0);
  const pid = project_id ? parseInt(project_id) : null;
  const noCycle = cycle_id === "no_cycle";
  const versionFilter = typeof cycle_id === "string" && cycle_id.startsWith("version:") ? cycle_id.replace("version:","").replace(/'/g, "''") : null;
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

  // Execuções dentro do filtro (uma linha = um caso em um ciclo)
  const execList = await query<any>(`SELECT e.id, e.test_case_id, e.cycle_id, e.status, e.executed_at, e.created_at, tc.module_id
    FROM test_executions e JOIN test_cycles c ON c.id = e.cycle_id
    JOIN test_cases tc ON tc.id = e.test_case_id JOIN modules m ON m.id = tc.module_id
    WHERE 1=1 ${pWhere} ${pWhereM} ${cWhereE} ${dWhereE}`);
  // Todos os casos cadastrados do projeto
  const caseList = await query<any>(`SELECT tc.id, tc.module_id FROM test_cases tc JOIN modules m ON m.id=tc.module_id WHERE 1=1 ${pWhereM}`);
  const totalCases = caseList.length;

  // Universo de casos considerados: com ciclo escolhido = os casos desse ciclo; senão = todos os cadastrados
  const universe = new Map<number, number>();
  if (cid) execList.forEach((e: any) => universe.set(Number(e.test_case_id), Number(e.module_id)));
  else caseList.forEach((c: any) => universe.set(Number(c.id), Number(c.module_id)));
  const stats = computeCaseStats(universe, execList.map((e: any) => ({ ...e, test_case_id: Number(e.test_case_id), module_id: Number(e.module_id), id: Number(e.id) })));
  const exec = { total: stats.total.total, passed: stats.total.passed, failed: stats.total.failed, blocked: stats.total.blocked, not_executed: stats.total.not_executed };

  // Bugs sempre contados por bug ÚNICO (um bug ligado a várias execuções não pode contar várias vezes)
  const bugAgg = `COUNT(*) AS total,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed,
      SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed`;
  let bugRows;
  if (cid) {
    bugRows = await query<any>(`SELECT ${bugAgg} FROM bugs b
      WHERE b.id IN (SELECT bug_id FROM test_executions WHERE cycle_id = ${cid} AND bug_id IS NOT NULL) ${pWhereB}`);
  } else if (noCycle) {
    bugRows = await query<any>(`SELECT ${bugAgg} FROM bugs b WHERE 1=1 ${pWhereB} ${dWhereB}
      AND b.id NOT IN (SELECT bug_id FROM test_executions WHERE bug_id IS NOT NULL)`);
  } else {
    // Sem filtro de ciclo (ou por versão): TODOS os bugs do projeto — o mesmo número da tela Bugs
    bugRows = await query<any>(`SELECT ${bugAgg} FROM bugs b WHERE 1=1 ${pWhereBV} ${dWhereB}`);
  }
  const bugs = bugRows[0] || {};

  const modNames = await query<any>(`SELECT m.id, m.name FROM modules m WHERE 1=1 ${pWhereM}`);
  const casesPerModule = new Map<number, number>();
  caseList.forEach((c: any) => casesPerModule.set(Number(c.module_id), (casesPerModule.get(Number(c.module_id)) || 0) + 1));
  const modRows = modNames.map((m: any) => {
    const st = stats.byModule.get(Number(m.id)) || { total: 0, passed: 0, failed: 0, blocked: 0, not_executed: 0 };
    return { id: m.id, name: m.name, total_cases: casesPerModule.get(Number(m.id)) || 0,
      total_executions: st.passed + st.failed + st.blocked, passed: st.passed, failed: st.failed, blocked: st.blocked, not_executed: st.not_executed };
  }).sort((a: any, b: any) => b.total_executions - a.total_executions);

  let bpmRows;
  if (cid) {
    bpmRows = await query<any>(`SELECT m.id, m.name,
      COUNT(DISTINCT b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs,
      SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed_bugs
      FROM modules m LEFT JOIN bugs b ON b.module_id = m.id
        AND b.id IN (SELECT DISTINCT e2.bug_id FROM test_executions e2 WHERE e2.cycle_id = ${cid} AND e2.bug_id IS NOT NULL)
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC`);
  } else if (noCycle) {
    bpmRows = await query<any>(`SELECT m.id, m.name,
      (SELECT COUNT(*) FROM test_cases tc WHERE tc.module_id = m.id) AS total_cases,
      COUNT(DISTINCT b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs,
      SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed_bugs
      FROM modules m
      LEFT JOIN bugs b ON b.module_id = m.id
        AND b.id NOT IN (SELECT DISTINCT bug_id FROM test_executions WHERE bug_id IS NOT NULL)
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC`);
  } else {
    // Sem filtro de ciclo: todos os bugs do projeto (igual ao card "Total de bugs")
    bpmRows = await query<any>(`SELECT m.id, m.name,
      COUNT(DISTINCT b.id) AS total_bugs,
      SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs,
      SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress_bugs,
      SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed_bugs,
      SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed_bugs
      FROM modules m
      LEFT JOIN bugs b ON b.module_id = m.id ${dWhereB}
      WHERE 1=1 ${pWhereM} GROUP BY m.id ORDER BY total_bugs DESC`);
  }

  const bugsByCycleRows = await query<any>(`SELECT x.cycle_id,
    COUNT(*) AS total,
    SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open,
    SUM(CASE WHEN b.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
    SUM(CASE WHEN b.status='fixed' THEN 1 ELSE 0 END) AS fixed,
    SUM(CASE WHEN b.status='closed' THEN 1 ELSE 0 END) AS closed
    FROM (SELECT DISTINCT e.cycle_id, e.bug_id FROM test_executions e JOIN test_cycles c ON c.id = e.cycle_id
          WHERE e.bug_id IS NOT NULL ${pWhere}) x
    JOIN bugs b ON b.id = x.bug_id GROUP BY x.cycle_id`);
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
    bugs_per_module: bpmRows.map((m: any) => ({...m, total_cases:num(m.total_cases), total_bugs:num(m.total_bugs), open_bugs:num(m.open_bugs), in_progress_bugs:num(m.in_progress_bugs), fixed_bugs:num(m.fixed_bugs), closed_bugs:num(m.closed_bugs)})),
    cycles: cycleRows.map((c: any) => ({...c, total_executions:num(c.total_executions), passed:num(c.passed), failed:num(c.failed), blocked:num(c.blocked), not_executed:num(c.not_executed), bugs: bugsByCycle[c.id] || {total:0,open:0,in_progress:0,fixed:0,closed:0}})),
    bugs_by_environment,
    all_bugs_versions: pid ? await query(`SELECT id, version, status FROM bugs WHERE project_id=$1 AND version IS NOT NULL AND version != ''`, [pid]) : [],
  };
}