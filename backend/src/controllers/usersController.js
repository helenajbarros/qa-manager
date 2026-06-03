const svc = require("../services/usersService");
const r   = require("../utils/response");

const login = async (req,res,next) => {
  try {
    const {email,password} = req.body;
    if (!email||!password) return r.badRequest(res,"email e password obrigatórios");
    const result = await svc.login(email,password);
    if (!result) return res.status(401).json({success:false,error:"Credenciais inválidas"});
    r.ok(res,result);
  } catch(e){next(e);}
};

const me = async (req,res,next) => {
  try {
    const u = await svc.findById(req.user.id);
    u ? r.ok(res,u) : r.notFound(res,"Usuário");
  } catch(e){next(e);}
};

const index = async (req,res,next) => {
  try {
    const { role, id } = req.user;
    // Admin vê todos; Gerente vê só ele mesmo + quem ele criou
    // Admin e Gerente veem todos os usuários
    r.ok(res, await svc.findAll());
  } catch(e){next(e);}
};

const show = async (req,res,next) => {
  try {
    const u = await svc.findById(req.params.id);
    if (!u) return r.notFound(res,"Usuário");

    r.ok(res,u);
  } catch(e){next(e);}
};

const store = async (req,res,next) => {
  try {
    const {name,email,password} = req.body;
    if (!name||!email||!password) return r.badRequest(res,"name, email e password obrigatórios");
    // Admin e Gerente podem criar usuários (mas não podem criar Admin se for Gerente)
    if (req.user.role !== "admin" && req.body.role === "admin") {
      return res.status(403).json({success:false,error:"Gerentes não podem criar usuários Admin"});
    }
    r.created(res, await svc.create({...req.body, created_by_id: req.user.id}));
  } catch(e){next(e);}
};

const update = async (req,res,next) => {
  try {
    const u = await svc.findById(req.params.id);
    if (!u) return r.notFound(res,"Usuário");
    // Gerente não pode promover para Admin
    if (req.user.role !== "admin" && req.body.role === "admin") {
      return res.status(403).json({success:false,error:"Gerentes não podem promover para Admin"});
    }
    r.ok(res, await svc.update(req.params.id, req.body));
  } catch(e){next(e);}
};

const destroy = async (req,res,next) => {
  try {
    if (String(req.params.id) === String(req.user.id))
      return r.badRequest(res,"Não pode excluir a si mesmo");
    const u = await svc.findById(req.params.id);
    if (!u) return r.notFound(res,"Usuário");

    const x = await svc.remove(req.params.id);
    x.changes === 0 ? r.notFound(res,"Usuário") : r.noContent(res);
  } catch(e){next(e);}
};

module.exports = { login, me, index, show, store, update, destroy };
