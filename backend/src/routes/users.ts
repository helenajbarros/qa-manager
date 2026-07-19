import { Router } from "express";
import * as c from "../controllers/usersController";
import { authenticate, requireAdmin, requireAdminOrManager } from "../middlewares/auth";

const router = Router();
router.post("/login",   c.login);
router.get("/me",       authenticate, c.me);
router.get("/mentions", authenticate, c.mentions);
router.get("/",         authenticate, requireAdminOrManager, c.index);
router.get("/:id/projects",  authenticate, c.getProjects);
router.post("/:id/projects", authenticate, requireAdminOrManager, c.saveProjects);
router.get("/:id",      authenticate, requireAdminOrManager, c.show);
router.post("/",        authenticate, requireAdminOrManager, c.store);
router.put("/:id",      authenticate, requireAdminOrManager, c.update);
router.delete("/:id",   authenticate, requireAdmin, c.destroy);
export default router;