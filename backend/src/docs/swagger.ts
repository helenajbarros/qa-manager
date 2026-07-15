import path from "path";
import fs from "fs";
import YAML from "yamljs";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

// Carrega o spec de docs/openapi.yaml. Em produção (dist/), o arquivo .yaml
// é copiado junto pelo script de build (ver package.json "build").
const specPath = path.resolve(__dirname, "openapi.yaml");
const swaggerDocument = YAML.load(specPath);

// Permite sobrescrever a URL de produção mostrada no Swagger UI via env,
// caso o domínio do Render mude no futuro.
if (process.env.API_PUBLIC_URL) {
  swaggerDocument.servers = [
    { url: process.env.API_PUBLIC_URL, description: "Produção" },
    ...(swaggerDocument.servers || []).filter((s: any) => s.description !== "Produção"),
  ];
}

// Coloca o ambiente em que a API está rodando de fato como primeiro item
// do dropdown "Servers" do Swagger UI — assim ele já abre selecionado no
// servidor certo (local quando rodando com NODE_ENV=development, Render
// quando NODE_ENV=production), em vez de sempre cair no Render por padrão
// e arriscar alguém testar rotas locais contra a API de produção.
function withCurrentServerFirst(doc: any): any {
  const servers: any[] = doc.servers || [];
  const isProd = process.env.NODE_ENV === "production";
  const matches = (s: any) => (isProd ? !s.url.includes("localhost") : s.url.includes("localhost"));
  const current = servers.filter(matches);
  const rest = servers.filter((s) => !matches(s));
  return { ...doc, servers: [...current, ...rest] };
}

export function mountSwagger(app: Express): void {
  const doc = withCurrentServerFirst(swaggerDocument);
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(doc, {
      customSiteTitle: "QA Manager API — Docs",
    })
  );
  // Spec cru, útil para importar no Postman/Insomnia
  app.get("/api/docs.json", (_req, res) => res.json(doc));
}

// Sanity check simples pra acusar cedo se o YAML não for encontrado no build.
if (!fs.existsSync(specPath)) {
  console.warn(`[swagger] openapi.yaml não encontrado em ${specPath}`);
}