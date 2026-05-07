const { pool } = require("./connection");
const crypto = require("crypto");

function hash(p) {
  return crypto.createHash("sha256").update(p + "qa_salt_2024").digest("hex");
}

async function runSeed() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT COUNT(*) AS c FROM users");
    if (parseInt(rows[0].c) > 0) return;

    // Projetos
    const { rows: [proj1] } = await client.query(
      "INSERT INTO projects (name, description) VALUES ($1,$2) RETURNING id",
      ["Projeto Principal", "Projeto padrão do sistema"]
    );
    await client.query(
      "INSERT INTO projects (name, description) VALUES ($1,$2)",
      ["App Mobile", "Aplicativo mobile iOS/Android"]
    );

    // Usuários
    const { rows: [admin] } = await client.query(
      "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,'admin') RETURNING id",
      ["Administrador", "admin@qa.com", hash("admin123")]
    );
    const { rows: [editor] } = await client.query(
      "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,'editor') RETURNING id",
      ["Helena Silva", "helena@qa.com", hash("helena123")]
    );

    // Módulos
    const { rows: [modLogin] } = await client.query(
      "INSERT INTO modules (project_id,name,description) VALUES ($1,$2,$3) RETURNING id",
      [proj1.id, "Login", "Funcionalidades de autenticação"]
    );
    const { rows: [modFin] } = await client.query(
      "INSERT INTO modules (project_id,name,description) VALUES ($1,$2,$3) RETURNING id",
      [proj1.id, "Financeiro", "Módulo de pagamentos"]
    );
    const { rows: [modUser] } = await client.query(
      "INSERT INTO modules (project_id,name,description) VALUES ($1,$2,$3) RETURNING id",
      [proj1.id, "Usuários", "Cadastro e gestão"]
    );

    // Casos de teste
    const tcData = [
      [modLogin.id, "Login com credenciais válidas",  "1. Acesse /login\n2. Informe email e senha\n3. Clique Entrar", "Usuário autenticado", "high"],
      [modLogin.id, "Login com senha incorreta",      "1. Informe senha errada\n2. Clique Entrar", "Mensagem de erro exibida", "high"],
      [modLogin.id, "Logout do sistema",              "1. Clique em Sair", "Redirecionado para /login", "medium"],
      [modFin.id,   "Gerar boleto de cobrança",       "1. Acesse Cobranças\n2. Gerar Boleto", "Boleto com código válido", "critical"],
      [modFin.id,   "Listar pagamentos do mês",       "1. Selecione o mês", "Lista de pagamentos exibida", "medium"],
      [modUser.id,  "Cadastrar usuário",              "1. Preencha os campos\n2. Salve", "Usuário criado na listagem", "high"],
    ];
    const tcIds = [];
    for (const [mid, title, steps, expected, priority] of tcData) {
      const { rows: [tc] } = await client.query(
        "INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        [mid, title, steps, expected, priority]
      );
      tcIds.push(tc.id);
    }

    // Ciclo Sprint 1
    const { rows: [cy1] } = await client.query(
      "INSERT INTO test_cycles (project_id,name,description,version,test_types,start_date,end_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [proj1.id, "Sprint 1", "Primeiro ciclo", "1.0.0", "Funcional,Regressão", "2025-01-06", "2025-01-20", "completed"]
    );
    const statuses = ["passed","passed","failed","not_executed","blocked","passed"];
    for (let i = 0; i < tcIds.length; i++) {
      await client.query(
        "INSERT INTO test_executions (cycle_id,test_case_id,status,executed_by_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [cy1.id, tcIds[i], statuses[i], editor.id]
      );
    }

    // Bugs
    await client.query(
      "INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description,tracker_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [proj1.id,"[Login] Botão Entrar não responde no Safari","high","open",modLogin.id,tcIds[0],editor.id,"Reproduzível no Safari 16+","https://app.clickup.com/t/abc123"]
    );
    await client.query(
      "INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [proj1.id,"[Financeiro] Valor do boleto arredonda errado","critical","in_progress",modFin.id,tcIds[3],editor.id,"Centavos truncados"]
    );
    await client.query(
      "INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [proj1.id,"[Usuários] Email duplicado não exibe erro","medium","fixed",modUser.id,tcIds[5],admin.id,"Falha silenciosa"]
    );

    console.log("[DB] Seed OK — admin@qa.com / admin123");
  } finally {
    client.release();
  }
}

module.exports = { runSeed };
