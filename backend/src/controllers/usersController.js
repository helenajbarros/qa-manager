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
    if (role === "admin") {
      // Admin vê todos os usuários
      r.ok(res, await svc.findAll());
    } else {
      // Gerente vê só ele mesmo + quem ele criou (exceto Admins)
      const users = await svc.findByCreator(id);
      const filtered = users.filter(u => u.role !== "admin");
      r.ok(res, filtered);
    }
  } catch(e){next(e);}
};

const show = async (req,res,next) => {
  try {
    const u = await svc.findById(req.params.id);
    if (!u) return r.notFound(res,"Usuário");
    // Gerente só pode ver a si mesmo ou usuários que criou (exceto Admins)
    if (req.user.role !== "admin") {
      if (u.role === "admin") return res.status(403).json({success:false,error:"Acesso negado"});
      if (String(req.params.id) !== String(req.user.id) &&
          String(u.created_by_id) !== String(req.user.id)) {
        return res.status(403).json({success:false,error:"Acesso negado"});
      }
    }
    r.ok(res,u);
  } catch(e){next(e);}
};

const store = async (req,res,next) => {
  try {
    const {name,email,password} = req.body;
    if (!name||!email||!password) return r.badRequest(res,"name, email e password obrigatórios");
    // Gerente não pode criar Admin nem outro Gerente
    if (req.user.role !== "admin" && ["admin","manager"].includes(req.body.role)) {
      return res.status(403).json({success:false,error:"Gerentes só podem criar Editores ou Visualizadores"});
    }
    r.created(res, await svc.create({...req.body, created_by_id: req.user.id}));
  } catch(e){next(e);}
};

const update = async (req,res,next) => {
  try {
    const u = await svc.findById(req.params.id);
    if (!u) return r.notFound(res,"Usuário");
    // Gerente não pode editar Admins nem usuários que não criou
    if (req.user.role !== "admin") {
      if (u.role === "admin") return res.status(403).json({success:false,error:"Acesso negado"});
      if (String(req.params.id) !== String(req.user.id) &&
          String(u.created_by_id) !== String(req.user.id)) {
        return res.status(403).json({success:false,error:"Acesso negado"});
      }
      // Gerente não pode promover para Admin nem para Gerente
      if (["admin","manager"].includes(req.body.role)) {
        return res.status(403).json({success:false,error:"Gerentes só podem atribuir Editor ou Visualizador"});
      }
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
    // Gerente não pode excluir Admins nem usuários que não criou
    if (req.user.role !== "admin") {
      if (u.role === "admin") return res.status(403).json({success:false,error:"Acesso negado"});
      if (String(u.created_by_id) !== String(req.user.id)) {
        return res.status(403).json({success:false,error:"Acesso negado"});
      }
    }
    const x = await svc.remove(req.params.id);
    x.changes === 0 ? r.notFound(res,"Usuário") : r.noContent(res);
  } catch(e){next(e);}
};

module.exports = { login, me, index, show, store, update, destroy };
