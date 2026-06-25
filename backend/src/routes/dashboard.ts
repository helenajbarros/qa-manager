import { Router } from "express";
import * as c from "../controllers/dashboardController";

const router = Router();
router.get("/", c.index);
export default router;