import { query, execute } from "../database/connection";

export async function findByProject(project_id: number | string) {
  return query(
    `SELECT * FROM project_environments WHERE project_id = $1 ORDER BY sort_order, id`,
    [project_id]
  );
}

export async function create(project_id: number | string, { name, color, sort_order }: any) {
  const rows = await query<{id: number}>(
    `INSERT INTO project_environments (project_id, name, color, sort_order) VALUES ($1,$2,$3,$4) RETURNING id`,
    [project_id, name.trim(), color || '#6B7280', sort_order || 0]
  );
  return rows[0];
}

export async function update(id: number | string, { name, color, sort_order }: any) {
  await execute(
    `UPDATE project_environments SET name=$1, color=$2, sort_order=$3 WHERE id=$4`,
    [name.trim(), color || '#6B7280', sort_order || 0, id]
  );
  return query(`SELECT * FROM project_environments WHERE id=$1`, [id]).then(r => r[0]);
}

export async function remove(id: number | string) {
  return execute(`DELETE FROM project_environments WHERE id=$1`, [id]);
}