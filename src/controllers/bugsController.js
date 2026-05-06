const svc = require("../services/bugsService");
const r   = require("../utils/response");

async function index(req, res, next) {
  try { r.ok(res, svc.findAll(req.query)); }
  catch (e) { next(e); }
}

async function show(req, res, next) {
  try {
    const item = svc.findById(req.params.id);
    item ? r.ok(res, item) : r.notFound(res, "Bug");
  } catch (e) { next(e); }
}

async function store(req, res, next) {
  try {
    if (!req.body.title?.trim()) return r.badRequest(res, "title é obrigatório");
    r.created(res, svc.create(req.body));
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    if (!req.body.title?.trim()) return r.badRequest(res, "title é obrigatório");
    if (!svc.findById(req.params.id)) return r.notFound(res, "Bug");
    r.ok(res, svc.update(req.params.id, req.body));
  } catch (e) { next(e); }
}

async function destroy(req, res, next) {
  try {
    const result = svc.remove(req.params.id);
    result.changes === 0 ? r.notFound(res, "Bug") : r.noContent(res);
  } catch (e) { next(e); }
}

module.exports = { index, show, store, update, destroy };
