import { Router } from "express";
import multer from "multer";
import * as c from "../controllers/testCasesController";
import { requireAdminOrManager, requireEditor } from "../middlewares/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.post("/excel/parse",  upload.single("file"), c.parseExcel);
router.post("/excel/import", upload.single("file"), c.importExcel);
router.post("/bulk-delete", requireAdminOrManager, c.bulkDestroy);
router.post("/bulk-update", requireEditor, c.bulkEdit);
router.get("/",     c.index);
router.get("/:id",  c.show);
router.post("/",    c.store);
router.put("/:id",  c.update);
router.delete("/:id", requireAdminOrManager, c.destroy);
router.get("/:id/activity", c.listActivity);
export default router;