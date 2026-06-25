import { query, execute } from "../database/connection";
import { getUserProjectIds } from "./userProjectsService";

const SQL = `SELECT p.*,
  (SELECT COUNT(*) FROM modules m WHERE m.project_id = p.id) AS module_count,
  (SELECT COUNT(*) FROM test_cycles c WHERE c.project_id = p.id) AS cycle_count,
  (SELECT COUNT(*) FROM bugs b WHERE b.project_id = p.id) AS bug_count
  FROM projects p`;

export async function findAll(userId: number, role: string) {
  if (role === "admin") return query(SQL + " ORDER BY p.name");
  if (role === "manager") {
    const linkedIds = await getUserProjectIds(userId, role) ?? [];
    if (linkedIds.length === 0) return query(SQL + " WHERE p.created_by_id = $1 ORDER BY p.name", [userId]);
    const ph = linkedIds.map((_: any, i: number) => `$${i + 2}`).join(",");
    return query(SQL + ` WHERE (p.created_by_id = $1 OR p.id IN (${ph})) ORDER BY p.name`, [userId, ...linkedIds]);
  }
  const ids = await getUserProjectIds(userId, role) ?? [];
  if (!ids.length) return [];
  const ph = ids.map((_: any, i: number) => `$${i + 1}`).join(",");
  return query(SQL + ` WHERE p.id IN (${ph}) ORDER BY p.name`, ids);
}

export async function findById(id: string | number) {
  const rows = await query("SELECT * FROM projects WHERE id = $1", [id]);
  return rows[0];
}

export async function create({ name, description, created_by_id }: { name: string; description?: string; created_by_id?: number }) {
  const rows = await query<{id: number}>("INSERT INTO projects (name,description,created_by_id) VALUES ($1,$2,$3) RETURNING id",
    [name.trim(), description || null, created_by_id || null]);
  return findById(rows[0].id);
}

export async function update(id: string | number, { name, description, active, logo_url }: any) {
  const cur = await findById(id) as any;
  if (!cur) return null;
  await execute("UPDATE projects SET name=$1,description=$2,active=$3,logo_url=$4 WHERE id=$5",
    [name?.trim() || cur.name, description || cur.description,
     active !== undefined ? (active ? 1 : 0) : cur.active,
     logo_url !== undefined ? logo_url : cur.logo_url, id]);
  return findById(id);
}

export async function saveLogo(id: string | number, fileBuffer: Buffer, mimetype: string) {
  const base64 = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
  await execute("UPDATE projects SET logo_url=$1 WHERE id=$2", [base64, id]);
  return findById(id);
}

export async function remove(id: string | number) {
  return execute("DELETE FROM projects WHERE id=$1", [id]);
}
