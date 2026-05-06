const svc = require("../services/usersService");
const r   = require("../utils/response");

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return r.badRequest(res, "email e password são obrigatórios");
    const result = svc.login(email, password);
    if (!result) return res.status(401).json({ success: false, error: "Credenciais inválidas" });
    r.ok(res, result);
  } catch(e) { next(e); }
}

async function me(req, res, next) {
  try {
    const user = svc.findById(req.user.id);
    user ? r.ok(res, user) : r.notFound(res, "Usuário");
  } catch(e) { next(e); }
}

async function index(req, res, next) {
  try { r.ok(res, svc.findAll()); } catch(e) { next(e); }
}

async function show(req, res, next) {
  try {
    const user = svc.findById(req.params.id);
    user ? r.ok(res, user) : r.notFound(res, "Usuário");
  } catch(e) { next(e); }
}

async function store(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return r.badRequest(res, "name, email e password são obrigatórios");
    r.created(res, svc.create({ name, email, password, role }));
  } catch(e) { next(e); }
}

async function update(req, res, next) {
  try {
    if (!svc.findById(req.params.id)) return r.notFound(res, "Usuário");
    r.ok(res, svc.update(req.params.id, req.body));
  } catch(e) { next(e); }
}

async function destroy(req, res, next) {
  try {
    if (String(req.params.id) === String(req.user.id))
      return r.badRequest(res, "Você não pode excluir a si mesmo");
    const result = svc.remove(req.params.id);
    result.changes === 0 ? r.notFound(res, "Usuário") : r.noContent(res);
  } catch(e) { next(e); }
}

module.exports = { login, me, index, show, store, update, destroy };
