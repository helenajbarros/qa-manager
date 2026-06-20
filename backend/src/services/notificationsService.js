const { query, execute } = require("../database/connection");

async function create({ user_id, type, message, link }) {
  if (!user_id) return;
  try {
    await execute(
      "INSERT INTO notifications (user_id, type, message, link) VALUES ($1,$2,$3,$4)",
      [user_id, type, message, link || null]
    );
  } catch(_) {}
}

async function findByUser(user_id) {
  return query(
    "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
    [user_id]
  );
}

async function markRead(id, user_id) {
  await execute("UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2", [id, user_id]);
}

async function markAllRead(user_id) {
  await execute("UPDATE notifications SET read=true WHERE user_id=$1", [user_id]);
}

async function countUnread(user_id) {
  const rows = await query("SELECT COUNT(*) AS total FROM notifications WHERE user_id=$1 AND read=false", [user_id]);
  return parseInt(rows[0]?.total || 0);
}

module.exports = { create, findByUser, markRead, markAllRead, countUnread };
