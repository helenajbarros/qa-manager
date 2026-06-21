const { query, execute } = require("../database/connection");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");

const SALT_ROUNDS = 10;
const JWT_SECRET  = process.env.JWT_SECRET || "qa_secret_fallback_change_in_production";
const JWT_EXPIRES = "8h";

// Hash antigo (SHA256) — usado só na migração e no login de compatibilidade
function sha256hash(p) { return crypto.createHash("sha256").update(p + "qa_salt_2024").digest("hex"); }

// Verifica senha: suporta bcrypt novo e sha256 antigo (migração transparente)
async function verifyPassword(plain, stored) {
  // Tenta bcrypt primeiro
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    return bcrypt.compare(plain, stored);
  }
  // Fallback: hash SHA256 antigo — se bater, rehasheia com bcrypt automaticamente
  return sha256hash(plain) === stored;
}

// Migração transparente: se senha ainda é SHA256, rehasheia com bcrypt ao logar
async function migratePasswordIfNeeded(userId, plain, stored) {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) return; // já é bcrypt
  const newHash = await bcrypt.hash(plain, SALT_ROUNDS);
  await execute("UPDATE users SET password=$1 WHERE id=$2", [newHash, userId]);
}

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

async function findAll() {
  return query("SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users ORDER BY name");
}

async function findById(id) {
  const rows = await query("SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users WHERE id=$1", [id]);
  return rows[0];
}

async function findByEmail(email) {
  const rows = await query("SELECT * FROM users WHERE email=$1", [email]);
  return rows[0];
}

async function login(email, password) {
  const user = await findByEmail(email);
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.password);
  if (!ok) return null;
  // Migração transparente: rehasheia com bcrypt se ainda é SHA256
  await migratePasswordIfNeeded(user.id, password, user.password);
  return { token: generateToken(user), user: await findById(user.id) };
}

async function findByCreator(creatorId) {
  return query(
    "SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users WHERE id=$1 OR created_by_id=$1 ORDER BY name",
    [creatorId]
  );
}

async function create({ name, email, password, role, default_project_id, created_by_id }) {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const rows = await query(
    "INSERT INTO users (name,email,password,role,default_project_id,created_by_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [name.trim(), email.trim().toLowerCase(), hashed, role || "viewer", default_project_id || null, created_by_id || null]
  );
  return findById(rows[0].id);
}

async function update(id, { name, email, role, active, password, default_project_id }) {
  const rows = await query("SELECT * FROM users WHERE id=$1", [id]);
  const c = rows[0]; if (!c) return null;
  const newPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : c.password;
  await execute(
    "UPDATE users SET name=$1,email=$2,role=$3,active=$4,password=$5,default_project_id=$6 WHERE id=$7",
    [name?.trim() || c.name, email?.trim().toLowerCase() || c.email, role || c.role,
     active !== undefined ? (active ? 1 : 0) : c.active, newPassword,
     default_project_id !== undefined ? (default_project_id || null) : c.default_project_id, id]
  );
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM users WHERE id=$1", [id]);
}

async function findAllForMentions() {
  return query("SELECT id, name FROM users ORDER BY name");
}

module.exports = { findAll, findById, findByEmail, findByCreator, findAllForMentions, login, create, update, remove, verifyToken };