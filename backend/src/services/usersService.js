const { query, execute } = require("../database/connection");
const crypto = require("crypto");

function hash(p) { return crypto.createHash("sha256").update(p+"qa_salt_2024").digest("hex"); }

// BUG 2 CORRIGIDO: token era base64 simples sem assinatura — qualquer um podia forjar.
// Agora usa HMAC-SHA256 com secret do ambiente para assinar o payload.
const SECRET = process.env.JWT_SECRET || "qa_secret_fallback_change_in_production";

function generateToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, ts: Date.now() })).toString("base64");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payload, sig] = (token || "").split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    // Comparação em tempo constante para evitar timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    const p = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (Date.now() - p.ts > 8*60*60*1000) return null;
    return p;
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
  if (user.password !== hash(password)) return null;
  return { token: generateToken(user), user: await findById(user.id) };
}

async function findByCreator(creatorId) {
  // Retorna o próprio usuário + todos que ele criou
  return query(
    "SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users WHERE id=$1 OR created_by_id=$1 ORDER BY name",
    [creatorId]
  );
}

async function create({ name, email, password, role, default_project_id, created_by_id }) {
  const rows = await query(
    "INSERT INTO users (name,email,password,role,default_project_id,created_by_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [name.trim(), email.trim().toLowerCase(), hash(password), role||"viewer", default_project_id||null, created_by_id||null]
  );
  return findById(rows[0].id);
}

async function update(id, { name, email, role, active, password, default_project_id }) {
  const rows = await query("SELECT * FROM users WHERE id=$1", [id]);
  const c = rows[0]; if (!c) return null;
  await execute("UPDATE users SET name=$1,email=$2,role=$3,active=$4,password=$5,default_project_id=$6 WHERE id=$7",
    [name?.trim()||c.name, email?.trim().toLowerCase()||c.email, role||c.role,
     active!==undefined?(active?1:0):c.active, password?hash(password):c.password,
     default_project_id!==undefined ? (default_project_id||null) : c.default_project_id, id]);
  return findById(id);
}

async function remove(id) {
  return execute("DELETE FROM users WHERE id=$1", [id]);
}

module.exports = { findAll, findById, findByEmail, findByCreator, login, create, update, remove, verifyToken };
