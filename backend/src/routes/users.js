const { Router } = require("express");
const c = require("../controllers/usersController");
const { authenticate, requireAdmin } = require("../middlewares/auth");

const router = Router();

router.post("/login",  c.login);
router.get("/me",      authenticate, c.me);

// Apenas admin gerencia usuários
router.get("/",        authenticate, requireAdmin, c.index);
router.get("/:id",     authenticate, requireAdmin, c.show);
router.post("/",       authenticate, requireAdmin, c.store);
router.put("/:id",     authenticate, requireAdmin, c.update);
router.delete("/:id",  authenticate, requireAdmin, c.destroy);

module.exports = router;
