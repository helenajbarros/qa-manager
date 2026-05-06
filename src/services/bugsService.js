const { db } = require("../database/connection");

// Extrai módulo do título quando estiver entre colchetes: "[Login] Botão falha"
function extractModuleId(title) {
  const match = title.match(/^\[(.+?)\]/);
  if (!match) return null;
  const name = match[1].trim().toLowerCase();
  const found = db.prepare("SELECT id FROM modules WHERE LOWER(name) = ?").get(name);
  return found?.id ?? null;
}

const WITH_MODULE = `
  SELECT b.*, m.name AS module_name
  FROM bugs b
  LEFT JOIN modules m ON m.id = b.module_id
`;

function findAll({ status, severity, module_id } = {}) {
  const conditions = [];
  const params = [];

  if (status)    { conditions.push("b.status = ?");    params.push(status); }
  if (severity)  { conditions.push("b.severity = ?");  params.push(severity); }
  if (module_id) { conditions.push("b.module_id = ?"); params.push(module_id); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.prepare(`${WITH_MODULE} ${where} ORDER BY b.created_at DESC`).all(...params);
}

function findById(id) {
  return db.prepare(`${WITH_MODULE} WHERE b.id = ?`).get(id);
}

function create({ title, description, severity, status, module_id }) {
  // module_id explícito tem prioridade; senão tenta extrair do título
  const resolvedModuleId = module_id ?? extractModuleId(title);

  const r = db.prepare(`
    INSERT INTO bugs (title, description, severity, status, module_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    description ?? null,
    severity    ?? "medium",
    status      ?? "open",
    resolvedModuleId
  );
  return findById(r.lastInsertRowid);
}

function update(id, { title, description, severity, status, module_id }) {
  const resolvedModuleId = module_id !== undefined ? module_id : extractModuleId(title);

  db.prepare(`
    UPDATE bugs
    SET title = ?, description = ?, severity = ?, status = ?, module_id = ?
    WHERE id = ?
  `).run(
    title.trim(),
    description ?? null,
    severity    ?? "medium",
    status      ?? "open",
    resolvedModuleId,
    id
  );
  return findById(id);
}

function remove(id) {
  return db.prepare("DELETE FROM bugs WHERE id = ?").run(id);
}

module.exports = { findAll, findById, create, update, remove };
