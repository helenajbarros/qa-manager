const { query, execute, USE_PG } = require("./connection");

async function addDefaultProjectColumn() {
  if (USE_PG) {
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_project_id INTEGER;
    `).catch(()=>{});
  } else {
    await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS default_project_id INTEGER`, []).catch(()=>{});
  }
  console.log("[DB] default_project_id OK");
}

module.exports = { addDefaultProjectColumn };
