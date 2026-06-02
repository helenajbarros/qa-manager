const { query, execute } = require("../database/connection");

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
  const result = await query(`${BASE} WHERE bc.id = $1`, [rows[0].id]);
  return result[0];
}

async function update(id, userId, text) {
  await execute(
    "UPDATE bug_comments SET text=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3",
    [text.trim(), id, userId]
  );
  const result = await query(`${BASE} WHERE bc.id = $1`, [id]);
  return result[0];
}

async function remove(id, userId, role) {
  if (role === "admin") {
    await execute("DELETE FROM bug_comments WHERE id=$1", [id]);
  } else {
    await execute("DELETE FROM bug_comments WHERE id=$1 AND user_id=$2", [id, userId]);
  }
}

module.exports = { findByBug, create, update, remove };
