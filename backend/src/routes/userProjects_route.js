const { Router } = require("express");
const { authenticate, requireAdminOrManager } = require("../middlewares/auth");
const { getProjectsForUser, setUserProjects } = require("../services/userProjectsService");
const svc = require("../services/usersService");
const r = require("../utils/response");

const router = Router();

router.get("/:id/projects", authenticate, async (req, res, next) => {
  try {
    const { role, id: myId } = req.user;
    const targetId = req.params.id;

    // Admin vê tudo; Gerente só vê projetos de si mesmo ou de quem criou
    if (role !== "admin") {
      const target = await svc.findById(targetId);
      if (!target) return r.notFound(res, "Usuário");
      if (String(targetId) !== String(myId) && String(target.created_by_id) !== String(myId)) {
        return res.status(403).json({success:false,error:"Acesso negado"});
      }
    }

    const ids = await getProjectsForUser(targetId);
    r.ok(res, ids);
  } catch(e) { next(e); }
});

router.put("/:id/projects", authenticate, requireAdminOrManager, async (req, res, next) => {
  try {
    const { role, id: myId } = req.user;
    const targetId = req.params.id;

    // Gerente só pode editar projetos de usuários que criou
    if (role !== "admin") {
      const target = await svc.findById(targetId);
      if (!target) return r.notFound(res, "Usuário");
      if (String(targetId) !== String(myId) && String(target.created_by_id) !== String(myId)) {
        return res.status(403).json({success:false,error:"Acesso negado"});
      }
    }

    const { project_ids } = req.body;
    const ids = await setUserProjects(targetId, project_ids || []);
    r.ok(res, ids);
  } catch(e) { next(e); }
});

module.exports = router;

