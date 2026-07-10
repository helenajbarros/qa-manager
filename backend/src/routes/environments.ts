import { Router } from "express";
import * as c from "../controllers/environmentsController";
import { requireAdminOrManager } from "../middlewares/auth";

const router = Router({ mergeParams: true });
router.get("/",     c.index);
router.post("/",    requireAdminOrManager, c.store);
router.put("/:id",  requireAdminOrManager, c.update);
router.delete("/:id", requireAdminOrManager, c.destroy);
export default router;