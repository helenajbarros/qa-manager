import { query, execute } from "../database/connection";

interface ModuleFilters { project_id?: string | number; search?: string; }
interface ModuleInput  { name: string; description?: string; project_id?: number | string; }

export async function findAll({ project_id, search }: ModuleFilters = {}) {
  const conds = ["1=1"]; const params: unknown[] = [];
  if (project_id) { params.push(project_id); conds.push(`m.project_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(m.name) LIKE $${params.length}`); }
  return query(`SELECT m.*, COUNT(tc.id) AS test_count FROM modules m LEFT JOIN test_cases tc ON tc.module_id = m.id WHERE ${conds.join(" AND ")} GROUP BY m.id ORDER BY m.name`, params);
}

export async function findById(id: string | number) {
  const rows = await query("SELECT * FROM modules WHERE id = $1", [id]);
  return rows[0];
}

export async function create({ name, description, project_id }: ModuleInput) {
  const rows = await query<{id: number}>("INSERT INTO modules (name,description,project_id) VALUES ($1,$2,$3) RETURNING id",
    [name.trim(), description || null, project_id || 1]);
  return findById(rows[0].id);
}

export async function update(id: string | number, { name, description }: Partial<ModuleInput>) {
  await execute("UPDATE modules SET name=$1, description=$2 WHERE id=$3", [name?.trim(), description || null, id]);
  return findById(id);
}

export async function remove(id: string | number) {
  const cases = await query<{total: string}>("SELECT COUNT(*) AS total FROM test_cases WHERE module_id=$1", [id]);
  const total = parseInt(cases[0]?.total || "0");
  if (total > 0) {
    const err = new Error(`Módulo possui ${total} caso(s) de teste vinculado(s). Remova os casos antes de excluir o módulo.`);
    (err as any).status = 400;
    throw err;
  }
  return execute("DELETE FROM modules WHERE id=$1", [id]);
}
