import { query, execute } from "../database/connection";

export async function findByCycle(cycle_id: number | string) {
  const rows = await query<any>(
    `SELECT tp.*, u.name AS created_by_name FROM test_plans tp
     LEFT JOIN users u ON u.id = tp.created_by_id
     WHERE tp.cycle_id = $1 LIMIT 1`, [cycle_id]);
  return rows[0] || null;
}

export async function upsert(cycle_id: number | string, data: any, created_by_id: number) {
  const existing = await findByCycle(cycle_id);
  const { objective, out_of_scope, entry_criteria, exit_criteria,
    strategy, risks, approver_qa, approver_manager, modules_scope,
    date_qa, date_manager } = data;
  const ms = modules_scope ? JSON.stringify(modules_scope) : null;

  if (existing) {
    await execute(
      `UPDATE test_plans SET objective=$1,out_of_scope=$2,entry_criteria=$3,exit_criteria=$4,
       strategy=$5,risks=$6,approver_qa=$7,approver_manager=$8,modules_scope=$9,
       date_qa=$10,date_manager=$11,updated_at=NOW()
       WHERE cycle_id=$12`,
      [objective||null,out_of_scope||null,entry_criteria||null,exit_criteria||null,
       strategy||null,risks||null,approver_qa||null,approver_manager||null,ms,
       date_qa||null,date_manager||null,cycle_id]);
  } else {
    await execute(
      `INSERT INTO test_plans (cycle_id,objective,out_of_scope,entry_criteria,exit_criteria,
       strategy,risks,approver_qa,approver_manager,modules_scope,date_qa,date_manager,created_by_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [cycle_id,objective||null,out_of_scope||null,entry_criteria||null,exit_criteria||null,
       strategy||null,risks||null,approver_qa||null,approver_manager||null,ms,
       date_qa||null,date_manager||null,created_by_id]);
  }
  return findByCycle(cycle_id);
}