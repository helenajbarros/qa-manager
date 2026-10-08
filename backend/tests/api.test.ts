import request from "supertest";

// bcrypt é um módulo nativo e não é usado nestes testes (nenhum chega a validar senha);
// o mock evita depender do binário compilado.
jest.mock("bcrypt", () => ({ hash: jest.fn(), compare: jest.fn() }));

// Variáveis de ambiente antes de carregar o app (o JWT lê JWT_SECRET ao importar).
process.env.JWT_SECRET = "segredo-de-teste";
process.env.QA_UPLOAD_DIR = require("os").tmpdir();

import app from "../src/app";
import jwt from "jsonwebtoken";

const tokenFor = (role: string) => jwt.sign({ id: 1, role }, process.env.JWT_SECRET as string);

describe("Infra", () => {
  it("GET /api/health responde ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/docs.json expõe a especificação OpenAPI", async () => {
    const res = await request(app).get("/api/docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths).toBeDefined();
  });

  it("GET /api/docs serve a interface do Swagger", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger");
  });
});

describe("Autenticação", () => {
  const rotasProtegidas = ["/api/modules", "/api/test-cases", "/api/cycles", "/api/dashboard"];

  it.each(rotasProtegidas)("GET %s sem token retorna 401", async (rota) => {
    const res = await request(app).get(rota);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejeita token inválido com 401", async () => {
    const res = await request(app).get("/api/modules").set("Authorization", "Bearer token-falso");
    expect(res.status).toBe(401);
  });
});

describe("Permissões por perfil", () => {
  it("usuário 'viewer' não pode excluir usuário (403)", async () => {
    const res = await request(app)
      .delete("/api/users/99")
      .set("Authorization", `Bearer ${tokenFor("viewer")}`);
    expect(res.status).toBe(403);
  });

  it("usuário 'editor' não pode listar usuários (403)", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${tokenFor("editor")}`);
    expect(res.status).toBe(403);
  });
});
