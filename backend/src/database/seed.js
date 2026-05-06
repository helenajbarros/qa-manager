const { db } = require("./connection");
const crypto = require("crypto");

function hash(p) {
  return crypto.createHash("sha256").update(p + "qa_salt_2024").digest("hex");
}

function runSeed() {
  const already = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (already > 0) return;

  // Projeto padrão
  const proj1 = db.prepare("INSERT INTO projects (name, description) VALUES (?,?)")
    .run("Projeto Principal", "Projeto padrão do sistema").lastInsertRowid;
  db.prepare("INSERT INTO projects (name, description) VALUES (?,?)")
    .run("App Mobile", "Aplicativo mobile iOS/Android");

  // Usuários
  const adminId  = db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,'admin')")
    .run("Administrador", "admin@qa.com", hash("admin123")).lastInsertRowid;
  const editorId = db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,'editor')")
    .run("Helena Silva", "helena@qa.com", hash("helena123")).lastInsertRowid;

  // Módulos
  const modLogin = db.prepare("INSERT INTO modules (project_id,name,description) VALUES (?,?,?)")
    .run(proj1, "Login", "Funcionalidades de autenticação").lastInsertRowid;
  const modFin   = db.prepare("INSERT INTO modules (project_id,name,description) VALUES (?,?,?)")
    .run(proj1, "Financeiro", "Módulo de pagamentos").lastInsertRowid;
  const modUser  = db.prepare("INSERT INTO modules (project_id,name,description) VALUES (?,?,?)")
    .run(proj1, "Usuários", "Cadastro e gestão").lastInsertRowid;

  // Casos de teste
  const tc1 = db.prepare("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES (?,?,?,?,?)")
    .run(modLogin,"Login com credenciais válidas","1. Acesse /login\n2. Informe email e senha válidos\n3. Clique Entrar","Usuário autenticado","high").lastInsertRowid;
  const tc2 = db.prepare("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES (?,?,?,?,?)")
    .run(modLogin,"Login com senha incorreta","1. Informe senha errada\n2. Clique Entrar","Mensagem de erro exibida","high").lastInsertRowid;
  const tc3 = db.prepare("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES (?,?,?,?,?)")
    .run(modLogin,"Logout do sistema","1. Clique em Sair","Redirecionado para /login","medium").lastInsertRowid;
  const tc4 = db.prepare("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES (?,?,?,?,?)")
    .run(modFin,"Gerar boleto","1. Acesse Cobranças\n2. Gerar Boleto","Boleto com código válido","critical").lastInsertRowid;
  const tc5 = db.prepare("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES (?,?,?,?,?)")
    .run(modFin,"Listar pagamentos","1. Selecione o mês","Lista de pagamentos exibida","medium").lastInsertRowid;
  const tc6 = db.prepare("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES (?,?,?,?,?)")
    .run(modUser,"Cadastrar usuário","1. Preencha os campos\n2. Salve","Usuário criado na listagem","high").lastInsertRowid;

  // Ciclo Sprint 1
  const cy1 = db.prepare("INSERT INTO test_cycles (project_id,name,description,version,test_types,start_date,end_date,status) VALUES (?,?,?,?,?,?,?,?)")
    .run(proj1,"Sprint 1","Primeiro ciclo","1.0.0","Funcional,Regressão","2025-01-06","2025-01-20","completed").lastInsertRowid;

  const statuses = ["passed","passed","failed","not_executed","blocked","passed"];
  [tc1,tc2,tc3,tc4,tc5,tc6].forEach((tc,i) => {
    db.prepare("INSERT OR IGNORE INTO test_executions (cycle_id,test_case_id,status,executed_by_id) VALUES (?,?,?,?)")
      .run(cy1, tc, statuses[i], editorId);
  });

  // Ciclo Sprint 2
  const cy2 = db.prepare("INSERT INTO test_cycles (project_id,name,description,version,test_types,start_date,end_date) VALUES (?,?,?,?,?,?,?)")
    .run(proj1,"Sprint 2","Segundo ciclo","1.1.0","Funcional,Smoke","2025-02-03","2025-02-17").lastInsertRowid;
  [tc1,tc4,tc6].forEach(tc => {
    db.prepare("INSERT OR IGNORE INTO test_executions (cycle_id,test_case_id,status,executed_by_id) VALUES (?,?,?,?)")
      .run(cy2, tc, "passed", editorId);
  });

  // Bugs
  db.prepare("INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description,tracker_url) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(proj1,"[Login] Botão Entrar não responde no Safari","high","open",modLogin,tc1,editorId,"Reproduzível no Safari 16+","https://app.clickup.com/t/abc123");
  db.prepare("INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES (?,?,?,?,?,?,?,?)")
    .run(proj1,"[Financeiro] Valor do boleto arredonda errado","critical","in_progress",modFin,tc4,editorId,"Centavos truncados");
  db.prepare("INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES (?,?,?,?,?,?,?,?)")
    .run(proj1,"[Usuários] Email duplicado não exibe erro","medium","fixed",modUser,tc6,adminId,"Falha silenciosa");

  console.log("[DB] Seed OK — admin@qa.com / admin123");
}

module.exports = { runSeed };
