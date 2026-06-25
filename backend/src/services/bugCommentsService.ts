import { query, execute } from "../database/connection";
import * as notif from "./notificationsService";

const BASE = `SELECT bc.*, u.name AS user_name FROM bug_comments bc LEFT JOIN users u ON u.id = bc.user_id`;

export async function findByBug(bugId: number | string) {
  return query(`${BASE} WHERE bc.bug_id = $1 ORDER BY bc.created_at ASC`, [bugId]);
}

export async function create(bugId: number | string, userId: number, text: string) {
  await query("INSERT INTO bug_comments (bug_id, user_id, text) VALUES ($1, $2, $3) RETURNING id",
    [bugId, userId, text.trim()]);
  try {
    const allUsers = await query<{id: number; name: string}>("SELECT id, name FROM users", []);
    for (const u of allUsers) {
      if (u.id === userId) continue;
      if (text.toLowerCase().includes(`@${u.name.toLowerCase()}`)) {
        await notif.create({ user_id: u.id, type: "mention",
          message: `Voce foi mencionado em um comentario no bug #${bugId}`, link: `/bugs/${bugId}` });
      }
    }
  } catch(e) { console.error("[NOTIF] erro ao notificar mencao:", (e as Error).message); }
  return findByBug(bugId);
}

export async function update(bugId: number | string, commentId: number | string, text: string) {
  await execute("UPDATE bug_comments SET text=$1 WHERE id=$2 AND bug_id=$3", [text.trim(), commentId, bugId]);
  return findByBug(bugId);
}

export async function remove(bugId: number | string, commentId: number | string) {
  await execute("DELETE FROM bug_comments WHERE id=$1 AND bug_id=$2", [commentId, bugId]);
  return findByBug(bugId);
}
