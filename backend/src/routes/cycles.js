const { Router } = require("express");
const c = require("../controllers/cyclesController");
const router = Router();

router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", c.destroy);

router.get("/:id/executions",                             c.listExecutions);
router.post("/:id/executions",                            c.addExecutions);
router.put("/:id/executions/:execId",                     c.updateExecution);
router.delete("/:id/executions/:execId",                  c.removeExecution);
router.post("/:id/executions/:execId/evidence",           ...c.uploadEvidence);
router.delete("/:id/executions/:execId/evidence/:fileId", c.deleteEvidence);

// Histórico de atividades do ciclo
router.get("/:id/activity", c.listActivity);

// Bug IDs vinculados ao ciclo
router.get("/:id/bugs", c.listBugs);

module.exports = router;
