import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc  from "../services/projectsService";
import * as r    from "../utils/response";
import multer    from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const index = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.findAll(req.user!.id, req.user!.role)); } catch(e){next(e);}
};
export const show = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { const d=await svc.findById(req.params.id); d?r.ok(res,d):r.notFound(res); } catch(e){next(e);}
};
export const store = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.created(res, await svc.create({...req.body, created_by_id: req.user!.id})); } catch(e){next(e);}
};
export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { const d=await svc.update(req.params.id,req.body); d?r.ok(res,d):r.notFound(res); } catch(e){next(e);}
};
export const destroy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { await svc.remove(req.params.id); r.ok(res, { deleted: true }); } catch(e){next(e);}
};
export const uploadLogo = [
  upload.single("logo"),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { r.badRequest(res, "Arquivo não enviado"); return; }
      r.ok(res, await svc.saveLogo(req.params.id, req.file.buffer, req.file.mimetype));
    } catch(e){next(e);}
  }
];