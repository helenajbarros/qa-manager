const { Router } = require("express");
const c = require("../controllers/testCasesController");
const router = Router();

router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", c.destroy);

// Histórico de atividades do caso de teste
router.get("/:id/activity", c.listActivity);

module.exports = router;
