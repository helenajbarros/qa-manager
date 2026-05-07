const { query, execute, USE_PG } = require("./connection");
const crypto = require("crypto");
function hash(p) { return crypto.createHash("sha256").update(p+"qa_salt_2024").digest("hex"); }

async function ins(sql, params) {
  if (USE_PG) { const r=await query(sql,params); return r[0]?.id; }
  else { const r=await execute(sql.replace(/\$\d+/g,"?"),params); return r.lastInsertRowid; }
}

async function runSeed() {
  const rows = await query("SELECT COUNT(*) AS c FROM users", []);
  const count = USE_PG ? parseInt(rows[0].c) : rows[0].c;
  if (count > 0) return;

  const p1 = await ins("INSERT INTO projects (name,description) VALUES ($1,$2) RETURNING id",["Projeto Principal","Projeto padrão"]);
  await ins("INSERT INTO projects (name,description) VALUES ($1,$2) RETURNING id",["App Mobile","App iOS/Android"]);

  const adminId  = await ins("INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,'admin') RETURNING id",["Administrador","admin@qa.com",hash("admin123")]);
  const editorId = await ins("INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,'editor') RETURNING id",["Helena Silva","helena@qa.com",hash("helena123")]);

  const mLogin = await ins("INSERT INTO modules (project_id,name,description) VALUES ($1,$2,$3) RETURNING id",[p1,"Login","Autenticação"]);
  const mFin   = await ins("INSERT INTO modules (project_id,name,description) VALUES ($1,$2,$3) RETURNING id",[p1,"Financeiro","Pagamentos"]);
  const mUser  = await ins("INSERT INTO modules (project_id,name,description) VALUES ($1,$2,$3) RETURNING id",[p1,"Usuários","Cadastro"]);

  const tcs = await Promise.all([
    ins("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",[mLogin,"Login com credenciais válidas","1. Acesse /login\n2. Informe email e senha","Usuário autenticado","high"]),
    ins("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",[mLogin,"Login com senha incorreta","1. Informe senha errada","Mensagem de erro","high"]),
    ins("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",[mLogin,"Logout do sistema","1. Clique em Sair","Redirecionado para /login","medium"]),
    ins("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",[mFin,"Gerar boleto","1. Gere o boleto","Boleto com código válido","critical"]),
    ins("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",[mFin,"Listar pagamentos","1. Selecione o mês","Lista exibida","medium"]),
    ins("INSERT INTO test_cases (module_id,title,steps,expected_result,priority) VALUES ($1,$2,$3,$4,$5) RETURNING id",[mUser,"Cadastrar usuário","1. Preencha e salve","Usuário criado","high"]),
  ]);

  const cycleId = await ins("INSERT INTO test_cycles (project_id,name,version,start_date,end_date,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",[p1,"Sprint 1","1.0.0","2025-01-06","2025-01-20","completed"]);

  const statuses=["passed","passed","failed","not_executed","blocked","passed"];
  for (let i=0;i<tcs.length;i++) {
    try {
      await ins("INSERT INTO test_executions (cycle_id,test_case_id,status,executed_by_id) VALUES ($1,$2,$3,$4) RETURNING id",[cycleId,tcs[i],statuses[i],editorId]);
    } catch(_) {}
  }

  await ins("INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[p1,"[Login] Botão não responde no Safari","high","open",mLogin,tcs[0],editorId,"Reproduzível no Safari 16+"]);
  await ins("INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[p1,"[Financeiro] Valor arredonda errado","critical","in_progress",mFin,tcs[3],editorId,"Centavos truncados"]);
  await ins("INSERT INTO bugs (project_id,title,severity,status,module_id,test_case_id,created_by_id,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[p1,"[Usuários] Email duplicado sem erro","medium","fixed",mUser,tcs[5],adminId,"Falha silenciosa"]);

  console.log("[DB] Seed OK — admin@qa.com / admin123");
}

module.exports = { runSeed };
