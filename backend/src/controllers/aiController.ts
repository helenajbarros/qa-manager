import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as r from "../utils/response";
import { analyzeTestCases } from "../services/aiAnalysisService";

export const analyze = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project_id = req.query.project_id ? Number(req.query.project_id) : null;
    if (!project_id) { r.badRequest(res, "project_id obrigatório"); return; }
    const analysis = await analyzeTestCases(project_id);
    r.ok(res, analysis);
  } catch(e) { next(e); }
};