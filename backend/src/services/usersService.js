const { query, execute } = require("../database/connection");
const crypto = require("crypto");

function hash(p) { return crypto.createHash("sha256").update(p+"qa_salt_2024").digest("hex"); }

function generateToken(user) {
  return Buffer.from(JSON.stringify({ id: user.id, role: user.role, ts: Date.now() })).toString("base64");
}

function verifyToken(token) {
  try {
    const p = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (Date.now() - p.ts > 8*60*60*1000) return null;
    return p;
  } catch { return null; }
}

async function findAll() {
  return query("SELECT id,name,email,role,active,created_at FROM users ORDER BY name");
}

async function findById(id) {
  const rows = await query("SELECT id,name,email,role,active,created_at FROM users WHERE id=$1", [id]);
  return rows[0];
}

async function findByEmail(email) {
  const rows = await query("SELECT * FROM users WHERE email=$1", [email]);
  return rows[0];
}

async function login(email, password) {
  const user = await findByEmail(email);
  if (!user || !user.active) return null;
  if (user.password !== hash(password)) return null;
  return { token: generateToken(user), user: await findById(user.id) };
}

async function create({ name, email, password, role }) {
  const rows = await query(
    "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id",
    [name.trim(), email.trim().toLowerCase(), hash(password), role||"viewer"]
  );
  return findById(rows[0].id);
}

async function update(id, { name, email, role, active, password }) {
  const rows = await query("SELECT * FROM users WHERE id=$1", [id]);
  const c = rows[0]; if (!c) return null;
  await execute("UPDATE users SET name=$1,email=$2,role=$3,active=$4,password=$5 WHERE id=$6",
    [name?.trim()||c.name, email?.trim().toLowerCase()||c.email, role||c.role,
     active!==undefined?(active?1:0):c.active, password?hash(password):c.password, id]);
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM users WHERE id=$1", [id]);
}

module.exports = { findAll, findById, findByEmail, login, create, update, remove, verifyToken };