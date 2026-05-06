const { db } = require("../database/connection");

// ── Cycles ────────────────────────────────────────────────────────────────────

function findAllCycles() {
  return db.prepare(`
    SELECT c.*,
      COUNT(e.id)  AS total_executions,
      SUM(CASE WHEN e.status = 'passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status = 'failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status = 'blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status = 'not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
}

function findCycleById(id) {
  return db.prepare("SELECT * FROM test_cycles WHERE id = ?").get(id);
}

function createCycle({ name, description }) {
  const r = db.prepare("INSERT INTO test_cycles (name, description) VALUES (?, ?)")
    .run(name.trim(), description ?? null);
  return findCycleById(r.lastInsertRowid);
}

function updateCycle(id, { name, description, status }) {
  db.prepare("UPDATE test_cycles SET name = ?, description = ?, status = ? WHERE id = ?")
    .run(name.trim(), description ?? null, status ?? "active", id);
  return findCycleById(id);
}

function removeCycle(id) {
  return db.prepare("DELETE FROM test_cycles WHERE id = ?").run(id);
}

// ── Executions ────────────────────────────────────────────────────────────────

const EXEC_WITH_DETAILS = `
  SELECT e.*, tc.title AS test_case_title, tc.priority,
         m.name AS module_name, b.title AS bug_title
  FROM test_executions e
  JOIN test_cases tc ON tc.id = e.test_case_id
  JOIN modules    m  ON m.id  = tc.module_id
  LEFT JOIN bugs  b  ON b.id  = e.bug_id
`;

function findExecutionsByCycle(cycle_id) {
  return db.prepare(`${EXEC_WITH_DETAILS} WHERE e.cycle_id = ? ORDER BY m.name, tc.title`)
    .all(cycle_id);
}

function findExecutionById(id) {
  return db.prepare(`${EXEC_WITH_DETAILS} WHERE e.id = ?`).get(id);
}

function addExecutions(cycle_id, test_case_ids) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO test_executions (cycle_id, test_case_id) VALUES (?, ?)"
  );
  db.transaction(() => {
    for (const tc_id of test_case_ids) insert.run(cycle_id, tc_id);
  })();
  return test_case_ids.length;
}

function updateExecution(id, { status, evidence, bug_id, notes }) {
  db.prepare(`
    UPDATE test_executions
    SET status = ?, evidence = ?, bug_id = ?, notes = ?,
        executed_at = CASE WHEN ? != 'not_executed' THEN datetime('now') ELSE executed_at END
    WHERE id = ?
  `).run(
    status   ?? "not_executed",
    evidence ?? null,
    bug_id   ?? null,
    notes    ?? null,
    status   ?? "not_executed",
    id
  );
  return findExecutionById(id);
}

function removeExecution(id) {
  return db.prepare("DELETE FROM test_executions WHERE id = ?").run(id);
}

module.exports = {
  findAllCycles, findCycleById, createCycle, updateCycle, removeCycle,
  findExecutionsByCycle, findExecutionById, addExecutions, updateExecution, removeExecution,
};
