import { Router } from "express";
import express from "express";
import type { Request, Response } from "express";
import { authenticate, requireAdmin, requireEditor } from "../middlewares/auth";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/clickupService";

const fail = (res: Response, e: any, code = 400) => res.status(code).json({ success: false, error: String(e?.message || e || "Erro no ClickUp").slice(0, 300) });
const ok = (res: Response, data: unknown) => res.json({ success: true, data });

/** Webhook do ClickUp: SEM login (o ClickUp não tem o seu token), protegido pela assinatura. Montado antes do express.json. */
export const clickupWebhook = [
  express.raw({ type: "*/*", limit: "1mb" }),
  async (req: Request, res: Response) => {
    try {
      const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      if (!(await svc.verifySignature(raw, String(req.headers["x-signature"] || "")))) { res.status(401).json({ success: false, error: "assinatura inválida" }); return; }
      const p = JSON.parse(raw.toString("utf8") || "{}");
      if (p.event === "taskStatusUpdated" && p.task_id) {
        const hist = (p.history_items || []).find((h: any) => h.field === "status");
        await svc.mirrorTask(String(p.task_id), hist?.after || undefined);
      }
      res.json({ success: true });
    } catch (e) { fail(res, e, 500); }
  },
];

const router = Router();
const uid = (req: any) => (req as AuthRequest).user?.id;
router.get("/status", authenticate, async (req, res) => { try { ok(res, await svc.status(uid(req))); } catch (e) { fail(res, e); } });
router.put("/my-token", authenticate, requireEditor, async (req, res) => {
  try { await svc.saveUserToken(uid(req)!, String(req.body?.token || "")); ok(res, await svc.status(uid(req))); } catch (e) { fail(res, e); }
});
router.delete("/my-token", authenticate, requireEditor, async (req, res) => {
  try { await svc.removeUserToken(uid(req)!); ok(res, await svc.status(uid(req))); } catch (e) { fail(res, e); }
});
router.put("/config", authenticate, requireAdmin, async (req, res) => {
  try {
    const { token, list, auto_send } = req.body || {};
    if (token) await svc.saveToken(String(token));
    if (typeof auto_send === "boolean") await svc.setAutoSend(auto_send);
    if (list?.id) await svc.saveList(list);
    ok(res, await svc.status(uid(req)));
  } catch (e) { fail(res, e); }
});
router.delete("/config", authenticate, requireAdmin, async (_req, res) => { try { await svc.removeCfg(); ok(res, { ok: true }); } catch (e) { fail(res, e); } });
router.get("/lists", authenticate, requireAdmin, async (req, res) => { try { ok(res, await svc.lists(uid(req))); } catch (e) { fail(res, e); } });
router.post("/mirror", authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.body?.on === false) { await svc.disableMirror(uid(req)); return ok(res, { mirrorOn: false }); }
    const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
    const r = await svc.enableMirror(base, uid(req));
    ok(res, { mirrorOn: true, ...r });
  } catch (e) { fail(res, e); }
});
router.post("/send", authenticate, requireEditor, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.bug_ids) ? req.body.bug_ids.map(Number).filter(Number.isFinite) : [];
    if (!ids.length) return fail(res, "Escolha pelo menos um bug.");
    ok(res, await svc.sendBugs(ids, (req as AuthRequest).user?.id));
  } catch (e) { fail(res, e); }
});
router.post("/sync", authenticate, requireEditor, async (req, res) => {
  try { ok(res, await svc.syncAll(req.body?.project_id ? Number(req.body.project_id) : undefined, uid(req))); } catch (e) { fail(res, e); }
});
export default router;
