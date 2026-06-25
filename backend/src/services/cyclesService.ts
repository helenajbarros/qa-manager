import { query, execute } from "../database/connection";

export async function logActivity(cycle_id: number | string, user_id: number | null, action: string, detail: string | null): Promise<void> {
  try { await query("INSERT INTO cycle_activity (cycle_id, user_id, action, detail) VALUES ($1,$2,$3,$4)", [cycle_id, user_id || null, action, detail || null]); }
  catch(err) { console.error("[cycle_activity] logActivity error:", (err as Error).message); }
}

export async function getActivity(cycle_id: number | string) {
  return query(`SELECT ca.*, u.name AS user_name FROM cycle_activity ca LEFT JOIN users u ON u.id = ca.user_id WHERE ca.cycle_id = $1 ORDER BY ca.created_at ASC`, [cycle_id]);
}

export async function findAllCycles({ project_id, search, page, limit }: any = {}) {
  const conds = ["1=1"]; const params: unknown[] = [];
  if (project_id) { params.push(project_id); conds.push(`c.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(c.name) LIKE $${params.length}`); }
  const where    = conds.join(" AND ");
  const pageNum  = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset   = (pageNum - 1) * pageSize;
  const countRows = await query<{total: string}>(`SELECT COUNT(*) AS total FROM test_cycles c WHERE ${where}`, params);
  const total = parseInt(countRows[0]?.total || "0");
  params.push(pageSize); const limitIdx = params.length;
  params.push(offset);   const offsetIdx = params.length;
  const rows = await query<any>(`SELECT c.*, COUNT(e.id) AS total_executions,
    SUM(CASE WHEN e.status='passed' THEN 1 ELSE 0 END) AS passed,
    SUM(CASE WHEN e.status='failed' THEN 1 ELSE 0 END) AS failed,
    SUM(CASE WHEN e.status='blocked' THEN 1 ELSE 0 END) AS blocked,
    SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c LEFT JOIN test_executions e ON e.cycle_id = c.id
    WHERE ${where} GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`, params);
  const data = rows.map((r: any) => ({...r, total_executions:parseInt(r.total_executions||0), passed:parseInt(r.passed||0), failed:parseInt(r.failed||0), blocked:parseInt(r.blocked||0), not_executed:parseInt(r.not_executed||0)}));
  return { data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
}

export async function findCycleById(id: number | string) {
  const rows = await query("SELECT * FROM test_cycles WHERE id=$1", [id]);
  return rows[0];
}

export async function createCycle({ name, description, version, test_types, start_date, end_date, project_id }: any) {
  const types = Array.isArray(test_types) ? test_types.join(",") : (test_types || null);
  const rows = await query<{id: number}>("INSERT INTO test_cycles (name,description,version,test_types,start_date,end_date,project_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [name.trim(), description||null, version||null, types, start_date||null, end_date||null, project_id||1]);
  const cycle = await findCycleById(rows[0].id);
  await logActivity(rows[0].id, null, "criou o ciclo", null);
  return cycle;
}

export async function updateCycle(id: number | string, { name, description, version, test_types, start_date, end_date, status }: any, userId?: number) {
  const prev  = await findCycleById(id) as any;
  const types = Array.isArray(test_types) ? test_types.join(",") : (test_types || null);
  await execute("UPDATE test_cycles SET name=$1,description=$2,version=$3,test_types=$4,start_date=$5,end_date=$6,status=$7 WHERE id=$8",
    [name.trim(), description||null, version||null, types, start_date||null, end_date||null, status||"active", id]);
  if (prev) {
    if (prev.name !== name.trim()) await logActivity(id, userId ?? null, "editou o nome", `"${prev.name}" → "${name.trim()}"`);
    if ((prev.status||"active") !== (status||"active")) await logActivity(id, userId ?? null, "alterou o status", `${prev.status} → ${status}`);
    if ((prev.version||"") !== (version||"")) await logActivity(id, userId ?? null, "alterou a versão", `${prev.version||"-"} → ${version||"-"}`);
  }
  if (status === "archived" && prev && prev.status !== "archived") {
    try {
      await execute(`UPDATE bugs SET status='closed', closed_by_archive=true WHERE id IN (SELECT DISTINCT bug_id FROM test_executions WHERE cycle_id=$1 AND bug_id IS NOT NULL) AND status NOT IN ('closed')`, [id]);
      const countRows = await query<{total: string}>(`SELECT COUNT(*) AS total FROM bugs WHERE closed_by_archive=true AND id IN (SELECT DISTINCT bug_id FROM test_executions WHERE cycle_id=$1 AND bug_id IS NOT NULL)`, [id]);
      const count = parseInt(countRows[0]?.total || "0");
      await logActivity(id, userId ?? null, "arquivou o ciclo", `${count} bug(s) fechado(s) automaticamente`);
    } catch(err) { console.error("[cyclesService] erro ao fechar bugs ao arquivar:", (err as Error).message); }
  }
  return findCycleById(id);
}

export async function removeCycle(id: number | string) { return execute("DELETE FROM test_cycles WHERE id=$1", [id]); }

const EXEC_BASE = `
  SELECT e.*, tc.title AS test_case_title, tc.priority, tc.description AS test_case_description,
    tc.steps, tc.expected_result, tc.preconditions, m.name AS module_name, m.id AS module_id,
    b.title AS bug_title, b.severity AS bug_severity, eu.name AS executed_by_name, au.name AS assigned_to_name
  FROM test_executions e JOIN test_cases tc ON tc.id = e.test_case_id JOIN modules m ON m.id = tc.module_id
  LEFT JOIN bugs b ON b.id = e.bug_id LEFT JOIN users eu ON eu.id = e.executed_by_id LEFT JOIN users au ON au.id = e.assigned_to_id
`;

async function parseExec(e: any) {
  const files = await query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1 ORDER BY created_at", [e.id]);
  return { ...e, evidence_files: files };
}

export async function findExecutionsByCycle(cycle_id: number | string) {
  const rows = await query(`${EXEC_BASE} WHERE e.cycle_id=$1 ORDER BY m.name, tc.id`, [cycle_id]);
  return Promise.all(rows.map(parseExec));
}

export async function findExecutionById(id: number | string) {
  const rows = await query(`${EXEC_BASE} WHERE e.id=$1`, [id]);
  return rows[0] ? parseExec(rows[0]) : undefined;
}

export async function addExecutions(cycle_id: number | string, test_case_ids: number[]) {
  for (const id of test_case_ids) {
    try { await query("INSERT INTO test_executions (cycle_id,test_case_id) VALUES ($1,$2) RETURNING id", [cycle_id, id]); }
    catch(_) {}
  }
  return test_case_ids.length;
}

export async function updateExecution(id: number | string, { status, evidence_url, comment, bug_id, notes, executed_by_id, assigned_to_id }: any) {
  await execute("UPDATE test_executions SET status=$1,evidence_url=$2,comment=$3,bug_id=$4,notes=$5,executed_by_id=$6,assigned_to_id=$7 WHERE id=$8",
    [status||"not_executed", evidence_url||null, comment||null, bug_id||null, notes||null, executed_by_id||null, assigned_to_id||null, id]);
  return findExecutionById(id);
}

export async function addEvidenceFile(execution_id: number | string, file: Express.Multer.File) {
  await execute("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('execution',$1,$2,$3,$4,$5)",
    [execution_id, file.filename, file.originalname, file.mimetype, file.size]);
  return query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1", [execution_id]);
}

export async function removeEvidenceFile(execution_id: number | string, file_id: number | string) {
  await execute("DELETE FROM evidence_files WHERE id=$1 AND ref_type='execution' AND ref_id=$2", [file_id, execution_id]);
  return query("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=$1", [execution_id]);
}

export async function removeExecution(id: number | string) { return execute("DELETE FROM test_executions WHERE id=$1", [id]); }

export async function getBugIdsByCycle(cycle_id: number | string) {
  const rows = await query<{bug_id: number}>("SELECT DISTINCT e.bug_id FROM test_executions e WHERE e.cycle_id = $1 AND e.bug_id IS NOT NULL", [cycle_id]);
  return rows.map(r => r.bug_id);
}
