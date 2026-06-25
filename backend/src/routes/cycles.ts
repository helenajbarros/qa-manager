import { Router } from "express";
import * as c from "../controllers/cyclesController";
import { requireAdminOrManager } from "../middlewares/auth";

const router = Router();
router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", requireAdminOrManager, c.destroy);
router.get("/:id/executions",                             c.listExecutions);
router.post("/:id/executions",                            c.addExecutions);
router.put("/:id/executions/:execId",                     c.updateExecution);
router.delete("/:id/executions/:execId",                  c.removeExecution);
router.post("/:id/executions/:execId/evidence",           ...(c.uploadEvidence as any[]));
router.delete("/:id/executions/:execId/evidence/:fileId", c.deleteEvidence);
router.get("/:id/activity", c.listActivity);
router.get("/:id/bugs",     c.listBugs);
export default router;