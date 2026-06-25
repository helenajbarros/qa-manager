import { Router } from "express";
import * as c from "../controllers/projectsController";
import { authenticate, requireAdmin, requireAdminOrManager } from "../middlewares/auth";

const router = Router();
router.get("/",          authenticate, c.index);
router.get("/:id",       authenticate, c.show);
router.post("/",         authenticate, requireAdminOrManager, c.store);
router.put("/:id",       authenticate, requireAdminOrManager, c.update);
router.delete("/:id",    authenticate, requireAdmin, c.destroy);
router.post("/:id/logo", authenticate, requireAdminOrManager, ...(c.uploadLogo as any[]));
export default router;