const { db }    = require("../database/connection");
const crypto    = require("crypto");

function hash(password) {
  return crypto.createHash("sha256").update(password + "qa_salt_2024").digest("hex");
}

// Token simples: base64 de id+role+timestamp — sem jwt para não precisar instalar
function generateToken(user) {
  const payload = JSON.stringify({ id: user.id, role: user.role, ts: Date.now() });
  return Buffer.from(payload).toString("base64");
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    // Expira em 8 horas
    if (Date.now() - payload.ts > 8 * 60 * 60 * 1000) return null;
    return payload;
  } catch { return null; }
}

function findAll() {
  return db.prepare(
    "SELECT id, name, email, role, active, created_at FROM users ORDER BY name"
  ).all();
}

function findById(id) {
  return db.prepare(
    "SELECT id, name, email, role, active, created_at FROM users WHERE id = ?"
  ).get(id);
}

function findByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function login(email, password) {
  const user = findByEmail(email);
  if (!user || !user.active) return null;
  if (user.password !== hash(password)) return null;
  return { token: generateToken(user), user: findById(user.id) };
}

function create({ name, email, password, role }) {
  const r = db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), email.trim().toLowerCase(), hash(password), role || "viewer");
  return findById(r.lastInsertRowid);
}

function update(id, { name, email, role, active, password }) {
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!current) return null;
  db.prepare(`
    UPDATE users SET name = ?, email = ?, role = ?, active = ?, password = ?
    WHERE id = ?
  `).run(
    name?.trim()                   ?? current.name,
    email?.trim().toLowerCase()    ?? current.email,
    role                           ?? current.role,
    active !== undefined ? (active ? 1 : 0) : current.active,
    password ? hash(password)      : current.password,
    id
  );
  return findById(id);
}

function remove(id) {
  return db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

module.exports = { findAll, findById, findByEmail, login, create, update, remove, verifyToken };
