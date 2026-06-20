const router = require("express").Router();
const { authenticate } = require("../middlewares/auth");
const svc = require("../services/notificationsService");
const r   = require("../utils/response");

router.use(authenticate);

// Listar notificações do usuário logado
router.get("/", async (req, res, next) => {
  try {
    const items = await svc.findByUser(req.user.id);
    const unread = await svc.countUnread(req.user.id);
    r.ok(res, { items, unread });
  } catch(e) { next(e); }
});

// Marcar uma como lida
router.put("/:id/read", async (req, res, next) => {
  try {
    await svc.markRead(req.params.id, req.user.id);
    r.ok(res, { success: true });
  } catch(e) { next(e); }
});

// Marcar todas como lidas
router.put("/read-all", async (req, res, next) => {
  try {
    await svc.markAllRead(req.user.id);
    r.ok(res, { success: true });
  } catch(e) { next(e); }
});

module.exports = router;
