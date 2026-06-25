import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import * as svc from "../services/bugCommentsService";
import * as r   from "../utils/response";
import type { AuthRequest } from "../types/index";

const router = Router({ mergeParams: true });

router.get("/", authenticate, async (req: AuthRequest, res, next) => {
  try { r.ok(res, await svc.findByBug((req as any).params.bugId)); }
  catch(e) { next(e); }
});

router.post("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { r.badRequest(res, "Texto obrigatório"); return; }
    r.created(res, await svc.create((req as any).params.bugId, req.user!.id, text));
  } catch(e) { next(e); }
});

router.put("/:id", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { r.badRequest(res, "Texto obrigatório"); return; }
    r.ok(res, await svc.update((req as any).params.bugId, req.params.id, text));
  } catch(e) { next(e); }
});

router.delete("/:id", authenticate, async (req: AuthRequest, res, next) => {
  try {
    await svc.remove((req as any).params.bugId, req.params.id);
    r.ok(res, { deleted: true });
  } catch(e) { next(e); }
});

export default router;
