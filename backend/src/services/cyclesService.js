const { db } = require("../database/connection");

function findAllCycles({ project_id, search } = {}) {
  const c = []; const p = [];
  if (project_id) { c.push("c.project_id=?"); p.push(project_id); }
  if (search)     { c.push("LOWER(c.name) LIKE ?"); p.push(`%${search.toLowerCase()}%`); }
  const w = c.length ? `WHERE ${c.join(" AND ")}` : "";
  return db.prepare(`
    SELECT c.*,
      COUNT(e.id)  AS total_executions,
      SUM(CASE WHEN e.status='passed'       THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN e.status='failed'       THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN e.status='blocked'      THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN e.status='not_executed' THEN 1 ELSE 0 END) AS not_executed
    FROM test_cycles c
    LEFT JOIN test_executions e ON e.cycle_id=c.id
    ${w} GROUP BY c.id ORDER BY c.created_at DESC
  `).all(...p);
}

function findCycleById(id) { return db.prepare("SELECT * FROM test_cycles WHERE id=?").get(id); }

function createCycle({ name, description, version, test_types, start_date, end_date, project_id }) {
  const r = db.prepare(`
    INSERT INTO test_cycles (name,description,version,test_types,start_date,end_date,project_id)
    VALUES (?,?,?,?,?,?,?)
  `).run(name.trim(), description??null, version??null,
         Array.isArray(test_types)?test_types.join(","):(test_types??null),
         start_date??null, end_date??null, project_id??1);
  return findCycleById(r.lastInsertRowid);
}

function updateCycle(id, { name, description, version, test_types, start_date, end_date, status }) {
  db.prepare(`
    UPDATE test_cycles SET name=?,description=?,version=?,test_types=?,start_date=?,end_date=?,status=?
    WHERE id=?
  `).run(name.trim(), description??null, version??null,
         Array.isArray(test_types)?test_types.join(","):(test_types??null),
         start_date??null, end_date??null, status??"active", id);
  return findCycleById(id);
}

function removeCycle(id) { return db.prepare("DELETE FROM test_cycles WHERE id=?").run(id); }

const EXEC_Q = `
  SELECT e.*,
    tc.title AS test_case_title, tc.priority,
    tc.description AS test_case_description,
    tc.steps, tc.expected_result, tc.preconditions,
    m.name AS module_name, m.id AS module_id,
    b.title AS bug_title,
    eu.name AS executed_by_name,
    au.name AS assigned_to_name
  FROM test_executions e
  JOIN test_cases tc ON tc.id=e.test_case_id
  JOIN modules    m  ON m.id=tc.module_id
  LEFT JOIN bugs  b  ON b.id=e.bug_id
  LEFT JOIN users eu ON eu.id=e.executed_by_id
  LEFT JOIN users au ON au.id=e.assigned_to_id
`;

function parseExec(e) {
  return { ...e, evidence_files: e.evidence_files ? JSON.parse(e.evidence_files) : [] };
}

function findExecutionsByCycle(cycle_id) {
  return db.prepare(`${EXEC_Q} WHERE e.cycle_id=? ORDER BY m.name, tc.id`).all(cycle_id).map(parseExec);
}

function findExecutionById(id) {
  const e = db.prepare(`${EXEC_Q} WHERE e.id=?`).get(id);
  return e ? parseExec(e) : undefined;
}

function addExecutions(cycle_id, test_case_ids) {
  const ins = db.prepare("INSERT OR IGNORE INTO test_executions (cycle_id,test_case_id) VALUES (?,?)");
  for (const id of test_case_ids) ins.run(cycle_id, id);
  return test_case_ids.length;
}

function updateExecution(id, { status, evidence_url, comment, bug_id, notes, evidence_files, executed_by_id, assigned_to_id }) {
  db.prepare(`
    UPDATE test_executions
    SET status=?,evidence_url=?,comment=?,bug_id=?,notes=?,evidence_files=?,
        executed_by_id=?,assigned_to_id=?,
        executed_at=CASE WHEN ?!='not_executed' THEN datetime('now') ELSE executed_at END
    WHERE id=?
  `).run(status??"not_executed", evidence_url??null, comment??null, bug_id??null,
         notes??null, evidence_files?JSON.stringify(evidence_files):null,
         executed_by_id??null, assigned_to_id??null, status??"not_executed", id);
  return findExecutionById(id);
}

function addEvidenceFile(execution_id, { filename, originalname, mimetype, size }) {
  db.prepare("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('execution',?,?,?,?,?)")
    .run(execution_id, filename, originalname, mimetype, size);
  const files = db.prepare("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=?").all(execution_id);
  db.prepare("UPDATE test_executions SET evidence_files=? WHERE id=?").run(JSON.stringify(files), execution_id);
  return files;
}

function removeEvidenceFile(execution_id, file_id) {
  db.prepare("DELETE FROM evidence_files WHERE id=? AND ref_type='execution' AND ref_id=?").run(file_id, execution_id);
  const files = db.prepare("SELECT * FROM evidence_files WHERE ref_type='execution' AND ref_id=?").all(execution_id);
  db.prepare("UPDATE test_executions SET evidence_files=? WHERE id=?").run(JSON.stringify(files), execution_id);
  return files;
}

function removeExecution(id) { return db.prepare("DELETE FROM test_executions WHERE id=?").run(id); }

module.exports = {
  findAllCycles, findCycleById, createCycle, updateCycle, removeCycle,
  findExecutionsByCycle, findExecutionById, addExecutions, updateExecution,
  addEvidenceFile, removeEvidenceFile, removeExecution,
};
