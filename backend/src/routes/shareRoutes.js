const { Router } = require("express");
const { query, execute } = require("../database/connection");
const r = require("../utils/response");
const { authenticate } = require("../middlewares/auth");
const crypto = require("crypto");

const router = Router();

// Gera token de compartilhamento para um bug
router.post("/bugs/:id/share", authenticate, async (req, res, next) => {
  try {
    const bugId = req.params.id;
    // Verifica se já existe token para esse bug
    const existing = await query(
      "SELECT token FROM share_tokens WHERE bug_id = $1", [bugId]
    );
    if (existing[0]) return r.ok(res, { token: existing[0].token });

    const token = crypto.randomBytes(24).toString("hex");
    await query(
      "INSERT INTO share_tokens (token, bug_id, created_by_id) VALUES ($1, $2, $3)",
      [token, bugId, req.user.id]
    );
    r.ok(res, { token });
  } catch(e) { next(e); }
});

// Rota pública — retorna bug pelo token sem autenticação
router.get("/share/:token", async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT bug_id FROM share_tokens WHERE token = $1", [req.params.token]
    );
    if (!rows[0]) return r.notFound(res, "Link inválido ou expirado");

    const { findById, getActivity } = require("../services/bugsService");
    const bug      = await findById(rows[0].bug_id);
    const activity = await getActivity(rows[0].bug_id);
    if (!bug) return r.notFound(res, "Bug não encontrado");

    r.ok(res, { ...bug, activity });
  } catch(e) { next(e); }
});

// Remove token de compartilhamento
router.delete("/bugs/:id/share", authenticate, async (req, res, next) => {
  try {
    await execute("DELETE FROM share_tokens WHERE bug_id = $1", [req.params.id]);
    r.ok(res, { deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
