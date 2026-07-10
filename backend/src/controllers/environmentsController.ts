import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as r from "../utils/response";
import * as svc from "../services/environmentsService";

export const index  = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.findByProject(req.params.projectId)); } catch(e){next(e);}
};
export const store  = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.created(res, await svc.create(req.params.projectId, req.body)); } catch(e){next(e);}
};
export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.update(req.params.id, req.body)); } catch(e){next(e);}
};
export const destroy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { await svc.remove(req.params.id); r.ok(res, { deleted: true }); } catch(e){next(e);}
};