const svc = require("../services/cyclesService");
const r   = require("../utils/response");

// ── Cycles ────────────────────────────────────────────────────────────────────

async function index(req, res, next) {
  try { r.ok(res, svc.findAllCycles()); }
  catch (e) { next(e); }
}

async function show(req, res, next) {
  try {
    const item = svc.findCycleById(req.params.id);
    item ? r.ok(res, item) : r.notFound(res, "Ciclo");
  } catch (e) { next(e); }
}

async function store(req, res, next) {
  try {
    if (!req.body.name?.trim()) return r.badRequest(res, "name é obrigatório");
    r.created(res, svc.createCycle(req.body));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    if (!req.body.name?.trim()) return r.badRequest(res, "name é obrigatório");
    if (!svc.findCycleById(req.params.id)) return r.notFound(res, "Ciclo");
    r.ok(res, svc.updateCycle(req.params.id, req.body));
  } catch (e) { next(e); }
}

async function destroy(req, res, next) {
  try {
    const result = svc.removeCycle(req.params.id);
    result.changes === 0 ? r.notFound(res, "Ciclo") : r.noContent(res);
  } catch (e) { next(e); }
}

// ── Executions ────────────────────────────────────────────────────────────────

async function listExecutions(req, res, next) {
  try { r.ok(res, svc.findExecutionsByCycle(req.params.id)); }
  catch (e) { next(e); }
}

async function addExecutions(req, res, next) {
  try {
    const { test_case_ids } = req.body;
    if (!Array.isArray(test_case_ids) || test_case_ids.length === 0)
      return r.badRequest(res, "test_case_ids deve ser um array não vazio");
    const added = svc.addExecutions(req.params.id, test_case_ids);
    r.created(res, { added });
  } catch (e) { next(e); }
}

async function updateExecution(req, res, next) {
  try {
    const exec = svc.findExecutionById(req.params.execId);
    if (!exec) return r.notFound(res, "Execução");
    r.ok(res, svc.updateExecution(req.params.execId, req.body));
  } catch (e) { next(e); }
}

async function removeExecution(req, res, next) {
  try {
    const result = svc.removeExecution(req.params.execId);
    result.changes === 0 ? r.notFound(res, "Execução") : r.noContent(res);
  } catch (e) { next(e); }
}

module.exports = {
  index, show, store, update, destroy,
  listExecutions, addExecutions, updateExecution, removeExecution,
};
