const { query, execute } = require("../database/connection");
const notif = require("./notificationsService");

const BASE = `
  SELECT bc.*, u.name AS user_name
  FROM bug_comments bc
  LEFT JOIN users u ON u.id = bc.user_id
`;

async function findByBug(bugId) {
  return query(`${BASE} WHERE bc.bug_id = $1 ORDER BY bc.created_at ASC`, [bugId]);
}

async function create(bugId, userId, text) {
  const rows = await query(
    "INSERT INTO bug_comments (bug_id, user_id, text) VALUES ($1, $2, $3) RETURNING id",
    [bugId, userId, text.trim()]
  );

  // Notificar usuarios mencionados com @nome
  try {
    const mentions = text.match(/@(\w+)/g) || [];
    if (mentions.length > 0) {
      const names = mentions.map(m => m.slice(1).toLowerCase());
      const users = await query(
        `SELECT id, name FROM users WHERE LOWER(name) = ANY($1::text[])`,
        [names]
      );
      for (const u of users) {
        if (u.id !== userId) {
          await notif.create({
            user_id: u.id,
            type: "mention",
            message: `Voce foi mencionado em um comentario no bug #${bugId}`,
            link: `/bugs/${bugId}`
          });
        }
      }
    }
  } catch(e) { console.error("[NOTIF] erro ao notificar mencao:", e.message); }

  const all = await findByBug(bugId);
  return { id: rows[0].id, comments: all };
}

async function update(bugId, commentId, text) {
  await execute(
    "UPDATE bug_comments SET text=$1 WHERE id=$2 AND bug_id=$3",
    [text.trim(), commentId, bugId]
  );
  return findByBug(bugId);
}

async function remove(bugId, commentId) {
  await execute("DELETE FROM bug_comments WHERE id=$1 AND bug_id=$2", [commentId, bugId]);
  return findByBug(bugId);
}

module.exports = { findByBug, create, update, remove };