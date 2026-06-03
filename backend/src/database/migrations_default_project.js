const { query, execute, USE_PG } = require("./connection");

async function addDefaultProjectColumn() {
  if (USE_PG) {
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_project_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_id INTEGER;
    `).catch(()=>{});
  } else {
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_project_id INTEGER`, []).catch(()=>{});
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_id INTEGER`, []).catch(()=>{});
  }
  console.log("[DB] default_project_id + created_by_id OK");
}

module.exports = { addDefaultProjectColumn };
