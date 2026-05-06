const { Router } = require("express");
const c = require("../controllers/cyclesController");

const router = Router();

// Cycles
router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", c.destroy);

// Executions (nested)
router.get("/:id/executions",             c.listExecutions);
router.post("/:id/executions",            c.addExecutions);
router.put("/:id/executions/:execId",     c.updateExecution);
router.delete("/:id/executions/:execId",  c.removeExecution);

module.exports = router;
