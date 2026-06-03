const { query, execute, USE_PG } = require("./connection");

async function addProjectsCreatorColumn() {
  if (USE_PG) {
    await query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_id INTEGER;`).catch(()=>{});
  } else {
    await execute(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_id INTEGER`, []).catch(()=>{});
  }
  console.log("[DB] projects created_by_id OK");
}

module.exports = { addProjectsCreatorColumn };
