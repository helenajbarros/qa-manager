const { Router } = require("express");
const { authenticate } = require("../middlewares/auth");
const svc = require("../services/bugCommentsService");
const r   = require("../utils/response");

const router = Router({ mergeParams: true });

router.get("/", authenticate, async (req, res, next) => {
  try {
    const data = await svc.findByBug(req.params.bugId);
    r.ok(res, data);
  } catch(e) { next(e); }
});

router.post("/", authenticate, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return r.badRequest(res, "Texto obrigatório");
    const data = await svc.create(req.params.bugId, req.user.id, text);
    r.created(res, data);
  } catch(e) { next(e); }
});

router.put("/:id", authenticate, async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return r.badRequest(res, "Texto obrigatório");
    const data = await svc.update(req.params.bugId, req.params.id, text);
    r.ok(res, data);
  } catch(e) { next(e); }
});

router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    await svc.remove(req.params.bugId, req.params.id);
    r.ok(res, { deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;