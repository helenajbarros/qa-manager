import { Router } from "express";
import * as c from "../controllers/aiController";
import { authenticate } from "../middlewares/auth";

const router = Router();
router.get("/analyze", authenticate, c.analyze);
export default router;