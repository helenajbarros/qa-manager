const { Router } = require("express");
const path   = require("path");
const multer = require("multer");
const c      = require("../controllers/projectsController");
const { authenticate, requireAdmin, requireEditor } = require("../middlewares/auth");

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../../uploads"),
  filename: (_req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

const router = Router();
router.get("/",           authenticate, c.index);
router.get("/:id",        authenticate, c.show);
router.post("/",          authenticate, requireAdmin, c.store);
router.put("/:id",        authenticate, requireAdmin, c.update);
router.delete("/:id",     authenticate, requireAdmin, c.destroy);
router.post("/:id/logo",  authenticate, requireAdmin, upload.single("logo"), c.uploadLogo);
module.exports = router;
