import { Router } from "express";
import * as c from "../controllers/testPlansController";
import { requireAdminOrManager } from "../middlewares/auth";
const router = Router({ mergeParams: true });
router.get("/", c.show);
router.put("/", requireAdminOrManager, c.upsert);
export default router;