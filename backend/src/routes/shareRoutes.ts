import { Router } from "express";
import { query, execute } from "../database/connection";
import * as r from "../utils/response";
import { authenticate } from "../middlewares/auth";
import * as bugsService from "../services/bugsService";
import crypto from "crypto";
import type { AuthRequest } from "../types/index";

const router = Router();

router.post("/bugs/:id/share", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const bugId = req.params.id;
    const existing = await query<{token: string}>("SELECT token FROM share_tokens WHERE bug_id = $1", [bugId]);
    if (existing[0]) { r.ok(res, { token: existing[0].token }); return; }
    const token = crypto.randomBytes(24).toString("hex");
    await query("INSERT INTO share_tokens (token, bug_id, created_by_id) VALUES ($1, $2, $3)",
      [token, bugId, req.user!.id]);
    r.ok(res, { token });
  } catch(e) { next(e); }
});

router.get("/share/:token", async (req, res, next) => {
  try {
    const rows = await query<{bug_id: number}>("SELECT bug_id FROM share_tokens WHERE token = $1", [req.params.token]);
    if (!rows[0]) { r.notFound(res, "Link inválido ou expirado"); return; }
    const bug      = await bugsService.findById(rows[0].bug_id);
    const activity = await bugsService.getActivity(rows[0].bug_id);
    if (!bug) { r.notFound(res, "Bug não encontrado"); return; }
    r.ok(res, { ...bug, activity });
  } catch(e) { next(e); }
});

router.delete("/bugs/:id/share", authenticate, async (req: AuthRequest, res, next) => {
  try {
    await execute("DELETE FROM share_tokens WHERE bug_id = $1", [req.params.id]);
    r.ok(res, { deleted: true });
  } catch(e) { next(e); }
});

export default router;
