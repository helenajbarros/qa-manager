const { db } = require("./connection");

function runSeed() {
  const alreadySeeded = db.prepare("SELECT COUNT(*) as c FROM modules").get().c;
  if (alreadySeeded > 0) return; // idempotente

  const insertModule = db.prepare(
    "INSERT INTO modules (name, description) VALUES (?, ?)"
  );
  const insertCase = db.prepare(`
    INSERT INTO test_cases (module_id, title, description, steps, expected_result, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCycle = db.prepare(
    "INSERT INTO test_cycles (name, description) VALUES (?, ?)"
  );
  const insertBug = db.prepare(`
    INSERT INTO bugs (title, severity, status, module_id, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    // Módulos
    const modLogin = insertModule.run("Login",      "Funcionalidades de autenticação").lastInsertRowid;
    const modFin   = insertModule.run("Financeiro", "Módulo de pagamentos e cobranças").lastInsertRowid;
    const modUser  = insertModule.run("Usuários",   "Cadastro e gestão de usuários").lastInsertRowid;

    // Casos de teste — Login
    insertCase.run(modLogin, "Login com credenciais válidas",
      "Verificar login com email e senha corretos",
      "1. Acesse /login\n2. Informe email e senha válidos\n3. Clique em Entrar",
      "Usuário autenticado e redirecionado para o dashboard", "high");

    insertCase.run(modLogin, "Login com senha incorreta",
      "Sistema deve exibir erro ao informar senha errada",
      "1. Acesse /login\n2. Informe email válido e senha errada\n3. Clique em Entrar",
      "Mensagem 'Credenciais inválidas' exibida", "high");

    insertCase.run(modLogin, "Logout do sistema",
      "Verificar encerramento de sessão",
      "1. Esteja logado\n2. Clique em Sair",
      "Sessão encerrada, redirecionado para /login", "medium");

    // Casos de teste — Financeiro
    insertCase.run(modFin, "Gerar boleto de cobrança",
      "Testar emissão de boleto",
      "1. Acesse Financeiro > Cobranças\n2. Clique em Gerar Boleto\n3. Preencha os dados",
      "Boleto gerado com código de barras válido", "critical");

    insertCase.run(modFin, "Listar pagamentos do mês",
      "Verificar listagem de pagamentos",
      "1. Acesse Financeiro > Pagamentos\n2. Selecione o mês atual",
      "Lista com todos os pagamentos do período exibida", "medium");

    // Casos de teste — Usuários
    insertCase.run(modUser, "Cadastrar novo usuário",
      "Testar fluxo de cadastro",
      "1. Acesse Usuários > Novo\n2. Preencha os campos obrigatórios\n3. Salve",
      "Usuário criado e aparece na listagem", "high");

    // Ciclo de exemplo
    const cycleId = insertCycle.run("Sprint 1", "Primeiro ciclo de testes do projeto").lastInsertRowid;

    // Adiciona execuções no ciclo
    const cases = db.prepare("SELECT id FROM test_cases").all();
    const insertExec = db.prepare(
      "INSERT OR IGNORE INTO test_executions (cycle_id, test_case_id, status) VALUES (?, ?, ?)"
    );
    const statuses = ["passed", "passed", "failed", "not_executed", "blocked", "passed"];
    cases.forEach((c, i) => insertExec.run(cycleId, c.id, statuses[i] || "not_executed"));

    // Bugs de exemplo
    insertBug.run("[Login] Botão Entrar não responde no Safari",  "high",   "open",        modLogin, "Reproduzível no Safari 16+");
    insertBug.run("[Financeiro] Valor do boleto arredonda errado","critical","in_progress", modFin,   "Valores com centavos são truncados");
    insertBug.run("[Usuários] Email duplicado não exibe erro",    "medium", "fixed",       modUser,  "Silenciosamente falha");
  })();

  console.log("[DB] Seed executado com sucesso.");
}

module.exports = { runSeed };
