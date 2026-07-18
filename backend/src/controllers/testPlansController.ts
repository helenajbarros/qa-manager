import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as r from "../utils/response";
import * as svc from "../services/testPlansService";

export const show = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.findByCycle(req.params.cycleId)); } catch(e){next(e);}
};
export const upsert = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.upsert(req.params.cycleId, req.body, req.user!.id)); } catch(e){next(e);}
};