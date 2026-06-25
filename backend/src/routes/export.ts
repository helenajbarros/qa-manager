import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { getExportData } from "../services/exportService";
import * as r from "../utils/response";
import type { AuthRequest } from "../types/index";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    r.ok(res, await getExportData({
      ...(req.query as any),
      user_id:   req.user!.id,
      user_role: req.user!.role,
    }));
  } catch(e) { next(e); }
});

export default router;
