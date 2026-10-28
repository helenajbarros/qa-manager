import { initDatabase, execute, query } from "../src/database/connection";
import { runMigrations } from "../src/database/migrations";
import { getDashboard, computeCaseStats } from "../src/services/dashboardService";
import { upgradeBugsTable } from "../src/database/migrations_bugs_v2";
import { addUserProjectsTable } from "../src/database/migrations_user_projects";
import { addBugCommentsTable } from "../src/database/migrations_bug_comments";
import { addShareTokensTable } from "../src/database/migrations_share_tokens";
import { addDefaultProjectColumn } from "../src/database/migrations_default_project";
import { addProjectsCreatorColumn } from "../src/database/migrations_projects_creator";
import { addActivityTables } from "../src/database/migrations_activity";
import { addBugTestType } from "../src/database/migrations_bug_test_type";
import { addNotificationsTable } from "../src/database/migrations_notifications";
import { addBugsV150Fields } from "../src/database/migrations_bugs_v150";
import { addEnvironmentsTable } from "../src/database/migrations_environments";
import fs from "fs";
import path from "path";

/**
 * Reproduz o cenário do dashboard que "não fazia sentido":
 * vários ciclos ativos (um por rodada do robô), o mesmo caso em mais de um ciclo
 * e um bug ligado a várias execuções.
 */
describe("Dashboard: números coerentes", () => {
  let pid: number;
  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    await initDatabase();
    await runMigrations();
    for (const f of [upgradeBugsTable, addUserProjectsTable, addBugCommentsTable, addShareTokensTable, addDefaultProjectColumn, addProjectsCreatorColumn, addActivityTables, addBugTestType, addNotificationsTable, addBugsV150Fields, addEnvironmentsTable]) await (f as any)();
    // o SQLite de desenvolvimento não recebe estas colunas nas migrações (só o PostgreSQL de produção)
    for (const col of ["environment_id INTEGER", "version TEXT"]) { try { await execute(`ALTER TABLE bugs ADD COLUMN ${col}`); } catch {} }
    const p: any = await query("INSERT INTO projects (name) VALUES ('T') RETURNING id");
    pid = p[0].id;
    const m: any = await query("INSERT INTO modules (name, project_id) VALUES ('M1',$1) RETURNING id", [pid]);
    const mod = m[0].id;
    const cases: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r: any = await query("INSERT INTO test_cases (module_id,title) VALUES ($1,$2) RETURNING id", [mod, "c" + i]);
      cases.push(r[0].id);
    }
    const cyc = async (name: string) => ((await query("INSERT INTO test_cycles (name,project_id,status) VALUES ($1,$2,'active') RETURNING id", [name, pid])) as any)[0].id;
    const c1 = await cyc("manual"), c2 = await cyc("robo 1"), c3 = await cyc("robo 2");
    const bug: any = await query("INSERT INTO bugs (title,project_id,module_id,status) VALUES ('b1',$1,$2,'open') RETURNING id", [pid, mod]);
    const b2: any = await query("INSERT INTO bugs (title,project_id,module_id,status) VALUES ('b2',$1,$2,'closed') RETURNING id", [pid, mod]);
    // ciclo manual: todos os 10 casos (3 passed, 2 failed, 5 não executados)
    const st1 = ["passed","passed","passed","failed","failed","not_executed","not_executed","not_executed","not_executed","not_executed"];
    for (let i = 0; i < 10; i++) await execute("INSERT INTO test_executions (cycle_id,test_case_id,status,created_at) VALUES ($1,$2,$3,'2026-01-01 10:00:00')", [c1, cases[i], st1[i]]);
    // robô 1 e 2: os mesmos casos 3 e 4 falham de novo, ambos ligados ao MESMO bug
    for (const c of [c2, c3]) for (const i of [3, 4]) await execute("INSERT INTO test_executions (cycle_id,test_case_id,status,bug_id,created_at) VALUES ($1,$2,'failed',$3,'2026-02-01 10:00:00')", [c, cases[i], bug[0].id]);
    // caso 0 re-executado depois e falhou: vale o resultado mais recente
    await execute("INSERT INTO test_executions (cycle_id,test_case_id,status,created_at) VALUES ($1,$2,'failed','2026-03-01 10:00:00')", [c2, cases[0]]);
    await execute("UPDATE test_executions SET bug_id=$1 WHERE cycle_id=$2 AND test_case_id=$3", [b2[0].id, c1, cases[3]]);
  });
  afterAll(() => { try { fs.rmSync(path.resolve(__dirname, "../data"), { recursive: true, force: true }); } catch {} });

  it("executados + não executados = casos cadastrados (sem contar caso×ciclo)", async () => {
    const d: any = await getDashboard({ project_id: String(pid) });
    const s = d.summary;
    expect(s.total_cases).toBe(10);
    expect(s.passed + s.failed + s.blocked + s.not_executed).toBe(s.total_cases);
    expect(s.total_executions).toBe(10);
    // 1,2 passaram; 0,3,4 falharam (0 pelo resultado mais recente); 5 não executados
    expect(s).toMatchObject({ passed: 2, failed: 3, blocked: 0, not_executed: 5 });
    expect(s.success_rate).toBe(40);
    expect(s.fail_rate).toBe(60);
  });

  it("bugs abertos nunca passam do total, e total conta bug único", async () => {
    const d: any = await getDashboard({ project_id: String(pid) });
    expect(d.bugs.total).toBe(2);
    expect(d.bugs.open).toBe(1);
    expect(d.bugs.closed).toBe(1);
    expect(d.bugs.open + d.bugs.in_progress + d.bugs.fixed + d.bugs.closed).toBe(d.bugs.total);
  });

  it("módulos somam igual ao total", async () => {
    const d: any = await getDashboard({ project_id: String(pid) });
    const sum = (k: string) => d.modules.reduce((a: number, m: any) => a + m[k], 0);
    expect(sum("passed")).toBe(d.summary.passed);
    expect(sum("failed")).toBe(d.summary.failed);
    expect(sum("not_executed")).toBe(d.summary.not_executed);
  });

  it("filtro de um ciclo conta só os casos daquele ciclo", async () => {
    const cycles: any = await query("SELECT id FROM test_cycles WHERE name='robo 1'");
    const d: any = await getDashboard({ project_id: String(pid), cycle_id: String(cycles[0].id) });
    expect(d.summary.total_executions).toBe(3); // casos 3, 4 e 0
    expect(d.summary.failed).toBe(3);
    expect(d.summary.not_executed).toBe(0);
    expect(d.bugs.total).toBe(1);
  });

  it("computeCaseStats: caso sem execução é não executado", () => {
    const r = computeCaseStats(new Map([[1, 1], [2, 1]]), [{ id: 1, test_case_id: 1, module_id: 1, status: "passed", created_at: "2026-01-01" }]);
    expect(r.total).toMatchObject({ total: 2, passed: 1, not_executed: 1 });
  });
});
