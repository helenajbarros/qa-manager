// ROTA TEMPORÁRIA DE MIGRAÇÃO
// Após rodar UMA VEZ, remova essa rota do server.js
// Acesse: GET https://qa-manager-api.onrender.com/api/migrate-passwords?secret=qa_migrate_2024

const express = require("express");
const router  = express.Router();
const { query, execute } = require("./database/connection");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const SALT_ROUNDS = 10;
const MIGRATE_SECRET = process.env.MIGRATE_SECRET || "qa_migrate_2024";

function sha256hash(p) {
  return crypto.createHash("sha256").update(p + "qa_salt_2024").digest("hex");
}

const KNOWN_PASSWORDS = {
  "admin@qa.com":        "admin123",
  "helena@qa.com":       "helena123",
  "userpadrao@qa.com":   "user123",
  "helenaadmin@qa.com":  "admin123",
  "pthiadmin@admin.com": "admin123",
};

router.get("/migrate-passwords", async (req, res) => {
  if (req.query.secret !== MIGRATE_SECRET) {
    return res.status(403).json({ error: "Acesso negado" });
  }

  const users = await query("SELECT id, email, password FROM users");
  const results = [];

  for (const user of users) {
    if (user.password.startsWith("$2b$") || user.password.startsWith("$2a$")) {
      results.push({ email: user.email, status: "ja_bcrypt" });
      continue;
    }

    const knownPass = KNOWN_PASSWORDS[user.email];
    if (knownPass && sha256hash(knownPass) === user.password) {
      const newHash = await bcrypt.hash(knownPass, SALT_ROUNDS);
      await execute("UPDATE users SET password=$1 WHERE id=$2", [newHash, user.id]);
      results.push({ email: user.email, status: "migrado_senha_conhecida" });
    } else {
      const newHash = await bcrypt.hash(user.password, SALT_ROUNDS);
      await execute("UPDATE users SET password=$1 WHERE id=$2", [newHash, user.id]);
      results.push({ email: user.email, status: "migrado_hash_reencapsulado" });
    }
  }

  res.json({ success: true, total: users.length, results });
});

module.exports = router;
