import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import * as svc from "../services/notificationsService";
import * as r   from "../utils/response";
import type { AuthRequest } from "../types/index";

const router = Router();
router.use(authenticate);

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const items  = await svc.findByUser(req.user!.id);
    const unread = await svc.countUnread(req.user!.id);
    r.ok(res, { items, unread });
  } catch(e) { next(e); }
});

router.put("/:id/read", async (req: AuthRequest, res, next) => {
  try {
    await svc.markRead(Number(req.params.id), req.user!.id);
    r.ok(res, { success: true });
  } catch(e) { next(e); }
});

router.put("/read-all", async (req: AuthRequest, res, next) => {
  try {
    await svc.markAllRead(req.user!.id);
    r.ok(res, { success: true });
  } catch(e) { next(e); }
});

export default router;
