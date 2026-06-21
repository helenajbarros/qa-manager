const { Router } = require("express");
const c = require("../controllers/usersController");
const { authenticate, requireAdmin, requireAdminOrManager } = require("../middlewares/auth");
const router = Router();

router.post("/login",  c.login);
router.get("/me",      authenticate, c.me);
router.get("/mentions", authenticate, c.mentions);
router.get("/",        authenticate, requireAdminOrManager, c.index);
router.get("/:id",     authenticate, requireAdminOrManager, c.show);
router.post("/",       authenticate, requireAdminOrManager, c.store);
router.put("/:id",     authenticate, requireAdminOrManager, c.update);
router.delete("/:id",  authenticate, requireAdmin, c.destroy);

module.exports = router;
