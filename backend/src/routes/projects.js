const { Router } = require("express");
const c = require("../controllers/projectsController");
const { authenticate, requireAdmin, requireAdminOrManager } = require("../middlewares/auth");
const router = Router();

router.get("/",          authenticate, c.index);
router.get("/:id",       authenticate, c.show);
router.post("/",         authenticate, requireAdminOrManager, c.store);
router.put("/:id",       authenticate, requireAdminOrManager, c.update);
router.delete("/:id",    authenticate, requireAdmin, c.destroy);
router.post("/:id/logo", authenticate, requireAdminOrManager, ...c.uploadLogo);

module.exports = router;
