const { Router } = require("express");
const c = require("../controllers/bugsController");
const { authenticate, requireAdminOrManager } = require("../middlewares/auth");
const router = Router();

router.get("/",                            authenticate, c.index);
router.get("/:id",                         authenticate, c.show);
router.post("/",                           authenticate, c.store);
router.put("/:id",                         authenticate, c.update);
router.delete("/:id",                      authenticate, requireAdminOrManager, c.destroy);
router.post("/:id/files",                  authenticate, ...c.uploadFile);
router.delete("/:id/files/:fileId",        authenticate, c.deleteFile);
router.post("/:id/relations",              authenticate, c.addRelation);
router.delete("/:id/relations/:relatedId", authenticate, c.removeRelation);

module.exports = router;