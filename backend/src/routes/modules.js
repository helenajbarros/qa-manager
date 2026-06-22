const { Router } = require("express");
const c = require("../controllers/modulesController");
const { requireAdminOrManager } = require("../middlewares/auth");

const router = Router();

router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", requireAdminOrManager, c.destroy);

module.exports = router;