const { Router } = require("express");
const { authenticate, requireAdmin } = require("../middlewares/auth");
const { getProjectsForUser, setUserProjects } = require("../services/UserProjectsService");
const r = require("../utils/response");

const router = Router();

// GET /api/users/:id/projects — projetos do usuário
router.get("/:id/projects", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const ids = await getProjectsForUser(req.params.id);
    r.ok(res, ids);
  } catch(e) { next(e); }
});

// PUT /api/users/:id/projects — define projetos do usuário
router.put("/:id/projects", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { project_ids } = req.body;
    const ids = await setUserProjects(req.params.id, project_ids || []);
    r.ok(res, ids);
  } catch(e) { next(e); }
});

module.exports = router;
