import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/testCasesService";
import * as r   from "../utils/response";

export const index = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await svc.findAll(req.query as any);
    if (result && (result as any).data) {
      res.json({ success:true, data:(result as any).data, total:(result as any).total, page:(result as any).page, pages:(result as any).pages });
    } else { r.ok(res, result); }
  } catch(e){next(e);}
};
export const show         = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.findById(req.params.id); x?r.ok(res,x):r.notFound(res,"Recurso"); } catch(e){next(e);} };
export const store        = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.created(res, await svc.create(req.body, req.user?.id)); } catch(e){next(e);} };
export const update       = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.update(req.params.id,req.body,req.user?.id); x?r.ok(res,x):r.notFound(res,"Recurso"); } catch(e){next(e);} };
export const destroy      = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.remove(req.params.id); (x as any).changes===0?r.notFound(res,"Recurso"):r.noContent(res); } catch(e){next(e);} };
export const listActivity = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.ok(res, await svc.getActivity(req.params.id)); } catch(e){next(e);} };