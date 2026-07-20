import { Router } from "express";
import * as c from "../controllers/usersController";
import { authenticate, requireAdmin, requireAdminOrManager } from "../middlewares/auth";

const router = Router();
router.post("/login",        c.login);
router.get("/me",            authenticate, c.me);
router.get("/mentions",      authenticate, c.mentions);
router.get("/",              authenticate, requireAdminOrManager, c.index);
router.post("/",             authenticate, requireAdminOrManager, c.store);
router.get("/projects/:id",  authenticate, c.getProjects);
router.post("/projects/:id", authenticate, requireAdminOrManager, c.saveProjects);
router.get("/:id",           authenticate, requireAdminOrManager, c.show);
router.put("/:id",           authenticate, requireAdminOrManager, c.update);
router.delete("/:id",        authenticate, requireAdminOrManager, c.destroy);
export default router;