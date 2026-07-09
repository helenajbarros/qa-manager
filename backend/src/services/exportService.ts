import { query } from "../database/connection";

interface ExportParams { project_id?: string | number; user_id?: number; user_role?: string; }

export async function getExportData({ project_id, user_id, user_role }: ExportParams = {}) {
  const pid = project_id ? parseInt(String(project_id)) : null;
  if (pid && user_role !== "admin") {
    const access = await query("SELECT 1 FROM user_projects WHERE user_id = $1 AND project_id = $2", [user_id, pid]);
    if (!access.length) { const err = new Error("Acesso negado ao projeto"); (err as any).status = 403; throw err; }
  }
  const pM = pid ? `AND m.project_id = ${pid}` : "";
  const pC = pid ? `AND c.project_id = ${pid}` : "";
  const pB = pid ? `AND b.project_id = ${pid}` : "";
  const [tc, cy, ex, bg, md] = await Promise.all([
    query(`SELECT tc.id,tc.title,tc.priority,tc.description,tc.preconditions,tc.steps,tc.expected_result,m.name AS module,u.name AS assigned_to,tc.created_at FROM test_cases tc JOIN modules m ON m.id=tc.module_id LEFT JOIN users u ON u.id=tc.assigned_to_id WHERE 1=1 ${pM} ORDER BY tc.id`),
    query(`SELECT c.*,COUNT(e.id) AS total,SUM(CASE WHEN e.status='passed' THEN 1 ELSE 0 END) AS passed,SUM(CASE WHEN e.status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN e.status='blocked' THEN 1 ELSE 0 END) AS blocked,SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed FROM test_cycles c LEFT JOIN test_executions e ON e.cycle_id=c.id WHERE 1=1 ${pC} GROUP BY c.id ORDER BY c.created_at DESC`),
    query(`SELECT e.id,e.cycle_id,c.name AS cycle,c.version,tc.id AS tc_id,tc.title AS test_case,m.name AS module,e.status,e.comment,e.evidence_url,e.notes,eu.name AS executed_by,au.name AS assigned_to,b.title AS bug_title,b.id AS bug_id,e.executed_at FROM test_executions e JOIN test_cycles c ON c.id=e.cycle_id JOIN test_cases tc ON tc.id=e.test_case_id JOIN modules m ON m.id=tc.module_id LEFT JOIN users eu ON eu.id=e.executed_by_id LEFT JOIN users au ON au.id=e.assigned_to_id LEFT JOIN bugs b ON b.id=e.bug_id WHERE 1=1 ${pC} ORDER BY c.name,m.name,tc.id`),
    query(`SELECT b.id,b.title,b.severity,b.status,m.name AS module,tc.id AS tc_id,tc.title AS test_case,b.comment,b.description,b.tracker_url,u.name AS created_by,b.created_at FROM bugs b LEFT JOIN modules m ON m.id=b.module_id LEFT JOIN test_cases tc ON tc.id=b.test_case_id LEFT JOIN users u ON u.id=b.created_by_id WHERE 1=1 ${pB} ORDER BY b.created_at DESC`),
    query(`SELECT m.name AS module,COUNT(DISTINCT tc.id) AS total_cases,COUNT(e.id) AS total_executions,SUM(CASE WHEN e.status='passed' THEN 1 ELSE 0 END) AS passed,SUM(CASE WHEN e.status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN e.status='blocked' THEN 1 ELSE 0 END) AS blocked,COUNT(DISTINCT b.id) AS total_bugs,SUM(CASE WHEN b.status='open' THEN 1 ELSE 0 END) AS open_bugs FROM modules m LEFT JOIN test_cases tc ON tc.module_id=m.id LEFT JOIN test_executions e ON e.test_case_id=tc.id LEFT JOIN bugs b ON b.module_id=m.id WHERE 1=1 ${pM} GROUP BY m.id ORDER BY m.name`),
  ]);
  return { testCases: tc, cycles: cy, executions: ex, bugs: bg, modules: md };
}