import { initDatabase, execute, query } from "../src/database/connection";
import { runMigrations } from "../src/database/migrations";
import { bulkRemove, bulkUpdate, remove } from "../src/services/testCasesService";
import fs from "fs";
import path from "path";

describe("casos de teste em lote", () => {
  let ids: number[] = [];
  let mod2 = 0;
  beforeAll(async () => {
    delete process.env.DATABASE_URL;
    await initDatabase();
    await runMigrations();
    const p: any = await query("INSERT INTO projects (name) VALUES ('T') RETURNING id");
    const m1: any = await query("INSERT INTO modules (name, project_id) VALUES ('M1',$1) RETURNING id", [p[0].id]);
    const m2: any = await query("INSERT INTO modules (name, project_id) VALUES ('M2',$1) RETURNING id", [p[0].id]);
    mod2 = m2[0].id;
    const cyc: any = await query("INSERT INTO test_cycles (name,project_id) VALUES ('c',$1) RETURNING id", [p[0].id]);
    for (let i = 0; i < 5; i++) {
      const r: any = await query("INSERT INTO test_cases (module_id,title,priority) VALUES ($1,$2,'low') RETURNING id", [m1[0].id, "c" + i]);
      ids.push(r[0].id);
      await execute("INSERT INTO test_executions (cycle_id,test_case_id) VALUES ($1,$2)", [cyc[0].id, r[0].id]);
    }
  });
  afterAll(() => { try { fs.rmSync(path.resolve(__dirname, "../data"), { recursive: true, force: true }); } catch {} });

  it("edita só os campos enviados, nos casos escolhidos", async () => {
    const r = await bulkUpdate([ids[0], ids[1]], { priority: "high", module_id: mod2 });
    expect(r.updated).toBe(2);
    const rows: any = await query("SELECT id,priority,module_id FROM test_cases ORDER BY id");
    expect(rows.filter((x: any) => x.priority === "high").map((x: any) => x.id)).toEqual([ids[0], ids[1]]);
    expect(rows.filter((x: any) => x.module_id === mod2).length).toBe(2);
    expect(rows[2].priority).toBe("low");
  });

  it("rejeita prioridade inválida e ignora ids inválidos", async () => {
    await expect(bulkUpdate([ids[2]], { priority: "xpto" })).rejects.toThrow();
    expect((await bulkUpdate(["a", -1, null] as any, { priority: "high" })).updated).toBe(0);
    expect((await bulkUpdate([ids[2]], {})).updated).toBe(0);
  });

  it("exclui em lote junto com as execuções", async () => {
    const r = await bulkRemove([ids[0], ids[1], ids[2]]);
    expect(r.deleted).toBe(3);
    const left: any = await query("SELECT id FROM test_cases");
    expect(left.map((x: any) => x.id).sort()).toEqual([ids[3], ids[4]].sort());
    const ex: any = await query("SELECT test_case_id FROM test_executions");
    expect(ex.length).toBe(2);
  });

  it("exclusão individual também leva as execuções", async () => {
    await remove(ids[3]);
    const ex: any = await query("SELECT test_case_id FROM test_executions");
    expect(ex.map((x: any) => x.test_case_id)).toEqual([ids[4]]);
  });
});
