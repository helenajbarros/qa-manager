// Script de migração de senhas SHA256 → bcrypt
// Executar UMA VEZ no servidor após o deploy:
// node src/migrate_passwords.js
//
// O script rehasheia todas as senhas SHA256 existentes com bcrypt.
// Senhas já em bcrypt são ignoradas.

const { query, execute, initDatabase } = require("./database/connection");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT_ROUNDS = 10;

function sha256hash(p) {
  return crypto.createHash("sha256").update(p + "qa_salt_2024").digest("hex");
}

// Senhas padrão conhecidas para migração
// Adicione aqui as senhas dos usuários que você conhece
const KNOWN_PASSWORDS = {
  "admin@qa.com":         "admin123",
  "helena@qa.com":        "helena123",
  "userpadrao@qa.com":    "user123",
  "helenaadmin@qa.com":   "admin123",
  "pthiadmin@admin.com":  "admin123",
};

async function migrate() {
  await initDatabase();

  const users = await query("SELECT id, email, password FROM users");
  console.log(`\n🔍 ${users.length} usuários encontrados\n`);

  let migrated = 0, skipped = 0, unknown = 0;

  for (const user of users) {
    // Já é bcrypt — pula
    if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
      console.log(`⏭  ${user.email} — já é bcrypt, ignorado`);
      skipped++;
      continue;
    }

    // Tenta migrar com senha conhecida
    const knownPass = KNOWN_PASSWORDS[user.email];
    if (knownPass && sha256hash(knownPass) === user.password) {
      const newHash = await bcrypt.hash(knownPass, SALT_ROUNDS);
      await execute("UPDATE users SET password=$1 WHERE id=$2", [newHash, user.id]);
      console.log(`✅ ${user.email} — migrado com senha conhecida`);
      migrated++;
      continue;
    }

    // Senha desconhecida — rehasheia o próprio hash SHA256 com bcrypt
    // (usuário precisará trocar a senha depois)
    const newHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    await execute("UPDATE users SET password=$1 WHERE id=$2", [newHash, user.id]);
    console.log(`⚠️  ${user.email} — migrado (senha desconhecida, hash re-encapsulado)`);
    unknown++;
  }

  console.log(`\n✅ Migrados com senha conhecida: ${migrated}`);
  console.log(`⏭  Já eram bcrypt (ignorados):   ${skipped}`);
  console.log(`⚠️  Hash re-encapsulado:           ${unknown}`);
  console.log(`\n⚠️  Usuários com "hash re-encapsulado" precisarão trocar a senha.`);
  console.log(`   Use a rota PUT /api/users/:id com a nova senha.\n`);

  process.exit(0);
}

migrate().catch(err => { console.error("Erro:", err); process.exit(1); });
