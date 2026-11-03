import crypto from "crypto";
jest.mock("bcrypt", () => ({ hash: jest.fn(), compare: jest.fn() }));
process.env.JWT_SECRET = "segredo-de-teste";
process.env.QA_UPLOAD_DIR = require("os").tmpdir();

const mockQuery = jest.fn();
const mockExecute = jest.fn();
jest.mock("../src/database/connection", () => ({ query: (...a: any[]) => mockQuery(...a), execute: (...a: any[]) => mockExecute(...a), queryOne: jest.fn(), USE_PG: false, initDatabase: jest.fn() }));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { mapStatus, buildTask, taskIdOf, enc, dec, isClickupUrl, pickClickupStatus } from "../src/services/clickupService";

const tokenFor = (role: string) => jwt.sign({ id: 1, role }, process.env.JWT_SECRET as string);

describe("ClickUp (QA Manager)", () => {
  beforeEach(() => { mockQuery.mockReset(); mockExecute.mockReset(); });

  it("escolhe na lista do ClickUp o status equivalente ao do bug", () => {
    const l = [{ status: "to do", type: "open" }, { status: "em andamento", type: "custom" }, { status: "em revisão", type: "custom" }, { status: "concluído", type: "done" }, { status: "fechado", type: "closed" }];
    expect(pickClickupStatus("open", l)).toBe("to do");
    expect(pickClickupStatus("in_progress", l)).toBe("em andamento");
    expect(pickClickupStatus("fixed", l)).toBe("concluído");
    expect(pickClickupStatus("closed", l)).toBe("fechado");
    expect(pickClickupStatus("fixed", [{ status: "to do", type: "open" }])).toBeNull();
  });
  it("mapeia status do ClickUp para o do bug", () => {
    expect(mapStatus({ status: "open", type: "open" })).toBe("open");
    expect(mapStatus({ status: "em andamento", type: "custom" })).toBe("in_progress");
    expect(mapStatus({ status: "in review", type: "custom" })).toBe("in_progress");
    expect(mapStatus({ status: "complete", type: "done" })).toBe("fixed");
    expect(mapStatus({ status: "closed", type: "closed" })).toBe("closed");
    expect(mapStatus({ status: "coisa estranha", type: "custom" })).toBeNull();
  });
  it("extrai o id da task e reconhece link do ClickUp", () => {
    expect(taskIdOf("https://app.clickup.com/t/86abc123")).toBe("86abc123");
    expect(taskIdOf("https://app.clickup.com/t/9012/ABC-12")).toBe("ABC-12");
    expect(isClickupUrl("https://jira.x/browse/1")).toBe(false);
  });
  it("cifra e decifra o token", () => {
    const e = enc("pk_123456789012");
    expect(e).not.toContain("pk_");
    expect(dec(e)).toBe("pk_123456789012");
  });
  it("monta a task com impacto, passos e prioridade", () => {
    const t = buildTask({ id: 7, title: "Erro ao salvar", severity: "high", priority: "critical", impact: "Não cadastra clientes", steps: "1. abrir", module_name: "Cadastro", created_by_name: "Ana" });
    expect(t.priority).toBe(1);
    expect(t.markdown_description).toContain("## Impacto no negócio");
    expect(t.markdown_description).toContain("Bug #7");
    expect(t.tags).toEqual(expect.arrayContaining(["qa-manager", "bug", "high", "cadastro"]));
  });

  it("webhook sem assinatura válida é recusado", async () => {
    mockQuery.mockResolvedValue([{ value: JSON.stringify({ webhookSecretEnc: enc("segredo") }) }]);
    const res = await request(app).post("/api/integrations/clickup/webhook").set("Content-Type", "application/json").send({ event: "taskStatusUpdated", task_id: "x" });
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });
  it("webhook com assinatura certa atualiza o status do bug", async () => {
    const body = JSON.stringify({ event: "taskStatusUpdated", task_id: "abc", history_items: [{ field: "status", after: { status: "em andamento", type: "custom" } }] });
    const sig = crypto.createHmac("sha256", "segredo").update(body).digest("hex");
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("app_settings")) return [{ value: JSON.stringify({ webhookSecretEnc: enc("segredo") }) }];
      if (sql.includes("FROM bugs WHERE tracker_url")) return [{ id: 5, status: "open" }];
      return [];
    });
    const res = await request(app).post("/api/integrations/clickup/webhook").set("Content-Type", "application/json").set("x-signature", sig).send(body);
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith("UPDATE bugs SET status=$1 WHERE id=$2", ["in_progress", 5]);
  });

  it("admin liga o envio automático e o status devolve a flag", async () => {
    let saved = "{}";
    mockQuery.mockImplementation(async (sql: string) => (sql.includes("app_settings") ? [{ key: "clickup", value: saved }] : []));
    mockExecute.mockImplementation(async (_sql: string, params: any[]) => { if (String(_sql).includes("UPDATE app_settings")) saved = params[0]; return { changes: 1 }; });
    const put = await request(app).put("/api/integrations/clickup/config").set("Authorization", `Bearer ${tokenFor("admin")}`).send({ auto_send: true });
    expect(put.status).toBe(200);
    expect(put.body.data.autoSend).toBe(true);
    expect((await request(app).put("/api/integrations/clickup/config").set("Authorization", `Bearer ${tokenFor("editor")}`).send({ auto_send: false })).status).toBe(403);
  });

  it("token pessoal: viewer não grava; token inválido é recusado", async () => {
    expect((await request(app).put("/api/integrations/clickup/my-token").set("Authorization", `Bearer ${tokenFor("viewer")}`).send({ token: "pk_123456789012" })).status).toBe(403);
    const bad = await request(app).put("/api/integrations/clickup/my-token").set("Authorization", `Bearer ${tokenFor("editor")}`).send({ token: "abc" });
    expect(bad.status).toBe(400);
  });
  it("configurar o token exige admin; enviar exige editor (viewer não)", async () => {
    expect((await request(app).put("/api/integrations/clickup/config").set("Authorization", `Bearer ${tokenFor("editor")}`).send({ token: "pk_123456789012" })).status).toBe(403);
    expect((await request(app).post("/api/integrations/clickup/send").set("Authorization", `Bearer ${tokenFor("viewer")}`).send({ bug_ids: [1] })).status).toBe(403);
    expect((await request(app).get("/api/integrations/clickup/status")).status).toBe(401);
  });
});
