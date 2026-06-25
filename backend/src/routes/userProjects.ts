import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth";
import { getProjectsForUser, setUserProjects } from "../services/userProjectsService";
import * as r from "../utils/response";
import type { AuthRequest } from "../types/index";

const router = Router();

router.get("/:id/projects", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    r.ok(res, await getProjectsForUser(Number(req.params.id)));
  } catch(e) { next(e); }
});

router.put("/:id/projects", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { project_ids } = req.body;
    r.ok(res, await setUserProjects(Number(req.params.id), project_ids || []));
  } catch(e) { next(e); }
});

export default router;
