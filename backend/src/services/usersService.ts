import { query, execute } from "../database/connection";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt    from "jsonwebtoken";

const SALT_ROUNDS = 10;
const JWT_SECRET  = process.env.JWT_SECRET || "qa_secret_fallback_change_in_production";
const JWT_EXPIRES = "8h";

function sha256hash(p: string): string {
  return crypto.createHash("sha256").update(p + "qa_salt_2024").digest("hex");
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) return bcrypt.compare(plain, stored);
  return sha256hash(plain) === stored;
}

async function migratePasswordIfNeeded(userId: number, plain: string, stored: string): Promise<void> {
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) return;
  const newHash = await bcrypt.hash(plain, SALT_ROUNDS);
  await execute("UPDATE users SET password=$1 WHERE id=$2", [newHash, userId]);
}

function generateToken(user: { id: number; role: string }): string {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): unknown {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

export async function findAll() {
  return query("SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users ORDER BY name");
}

export async function findById(id: number | string) {
  const rows = await query("SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users WHERE id=$1", [id]);
  return rows[0];
}

export async function findByEmail(email: string) {
  const rows = await query("SELECT * FROM users WHERE email=$1", [email]);
  return rows[0];
}

export async function login(email: string, password: string) {
  const user = await findByEmail(email) as any;
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.password);
  if (!ok) return null;
  await migratePasswordIfNeeded(user.id, password, user.password);
  return { token: generateToken(user), user: await findById(user.id) };
}

export async function findByCreator(creatorId: number) {
  return query("SELECT id,name,email,role,active,default_project_id,created_by_id,created_at FROM users WHERE id=$1 OR created_by_id=$1 ORDER BY name", [creatorId]);
}

export async function create({ name, email, password, role, default_project_id, created_by_id }: {
  name: string; email: string; password: string; role?: string;
  default_project_id?: number; created_by_id?: number;
}) {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const rows = await query<{id: number}>("INSERT INTO users (name,email,password,role,default_project_id,created_by_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [name.trim(), email.trim().toLowerCase(), hashed, role || "viewer", default_project_id || null, created_by_id || null]);
  return findById(rows[0].id);
}

export async function update(id: number | string, { name, email, role, active, password, default_project_id }: any) {
  const rows = await query("SELECT * FROM users WHERE id=$1", [id]);
  const c = (rows[0] as any); if (!c) return null;
  const newPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : c.password;
  await execute("UPDATE users SET name=$1,email=$2,role=$3,active=$4,password=$5,default_project_id=$6 WHERE id=$7",
    [name?.trim() || c.name, email?.trim().toLowerCase() || c.email, role || c.role,
     active !== undefined ? (active ? 1 : 0) : c.active, newPassword,
     default_project_id !== undefined ? (default_project_id || null) : c.default_project_id, id]);
  return findById(id);
}

export async function remove(id: number | string) {
  return execute("DELETE FROM users WHERE id=$1", [id]);
}

export async function findAllForMentions() {
  return query("SELECT id, name FROM users ORDER BY name");
}
