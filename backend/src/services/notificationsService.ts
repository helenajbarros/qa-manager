import { query, execute } from "../database/connection";

interface NotifInput { user_id: number; type: string; message: string; link?: string; }

export async function create({ user_id, type, message, link }: NotifInput): Promise<void> {
  if (!user_id) return;
  try { await execute("INSERT INTO notifications (user_id, type, message, link) VALUES ($1,$2,$3,$4)", [user_id, type, message, link || null]); }
  catch(_) {}
}

export async function findByUser(user_id: number) {
  return query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [user_id]);
}

export async function markRead(id: number, user_id: number): Promise<void> {
  await execute("UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2", [id, user_id]);
}

export async function markAllRead(user_id: number): Promise<void> {
  await execute("UPDATE notifications SET read=true WHERE user_id=$1", [user_id]);
}

export async function countUnread(user_id: number): Promise<number> {
  const rows = await query<{total: string}>("SELECT COUNT(*) AS total FROM notifications WHERE user_id=$1 AND read=false", [user_id]);
  return parseInt(rows[0]?.total || "0");
}
