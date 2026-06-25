import { Router } from "express";
import * as c from "../controllers/testCasesController";
import { requireAdminOrManager } from "../middlewares/auth";

const router = Router();
router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", requireAdminOrManager, c.destroy);
router.get("/:id/activity", c.listActivity);
export default router;