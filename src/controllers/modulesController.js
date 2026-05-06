const svc = require("../services/modulesService");
const r   = require("../utils/response");

async function index(req, res, next) {
  try { r.ok(res, svc.findAll()); }
  catch (e) { next(e); }
}

async function show(req, res, next) {
  try {
    const item = svc.findById(req.params.id);
    item ? r.ok(res, item) : r.notFound(res, "Módulo");
  } catch (e) { next(e); }
}

async function store(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return r.badRequest(res, "name é obrigatório");
    r.created(res, svc.create({ name, description }));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return r.badRequest(res, "name é obrigatório");
    if (!svc.findById(req.params.id)) return r.notFound(res, "Módulo");
    r.ok(res, svc.update(req.params.id, { name, description }));
  } catch (e) { next(e); }
}

async function destroy(req, res, next) {
  try {
    const result = svc.remove(req.params.id);
    result.changes === 0 ? r.notFound(res, "Módulo") : r.noContent(res);
  } catch (e) { next(e); }
}

module.exports = { index, show, store, update, destroy };
