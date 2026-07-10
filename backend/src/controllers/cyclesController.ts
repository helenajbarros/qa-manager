import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/cyclesService";
import * as r   from "../utils/response";
import path     from "path";
import multer   from "multer";

const UPLOAD_DIR = process.env.QA_UPLOAD_DIR || path.resolve(__dirname, "../../uploads");
const storage = multer.diskStorage({
  destination: (_: any, __: any, cb: any) => cb(null, UPLOAD_DIR),
  filename:    (_: any, file: any, cb: any) => cb(null, `${Date.now()}_${file.originalname.replace(/\s/g,"_")}`),
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 } });

export const index   = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await svc.findAllCycles(req.query as any);
    if (result && (result as any).data) {
      res.json({ success:true, data:(result as any).data, total:(result as any).total, page:(result as any).page, pages:(result as any).pages });
    } else { r.ok(res, result); }
  } catch(e){next(e);}
};
export const show            = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.findCycleById(req.params.id); x?r.ok(res,x):r.notFound(res,"Ciclo"); } catch(e){next(e);} };
export const store           = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { if(!req.body.name?.trim()){r.badRequest(res,"name obrigatório");return;} r.created(res, await svc.createCycle(req.body)); } catch(e){next(e);} };
export const update          = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { if(!req.body.name?.trim()){r.badRequest(res,"name obrigatório");return;} r.ok(res, await svc.updateCycle(req.params.id,req.body,req.user?.id)); } catch(e){next(e);} };
export const destroy         = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.removeCycle(req.params.id); (x as any).changes===0?r.notFound(res,"Ciclo"):r.noContent(res); } catch(e){next(e);} };
export const listExecutions  = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.ok(res, await svc.findExecutionsByCycle(req.params.id)); } catch(e){next(e);} };
export const addExecutions   = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const {test_case_ids}=req.body; if(!Array.isArray(test_case_ids)||!test_case_ids.length){r.badRequest(res,"test_case_ids obrigatório");return;} r.created(res,{added: await svc.addExecutions(req.params.id,test_case_ids)}); } catch(e){next(e);} };
export const updateExecution = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.findExecutionById(req.params.execId); if(!x){r.notFound(res,"Execução");return;} r.ok(res, await svc.updateExecution(req.params.execId,req.body)); } catch(e){next(e);} };
export const removeExecution = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { const x=await svc.removeExecution(req.params.execId); (x as any).changes===0?r.notFound(res,"Execução"):r.noContent(res); } catch(e){next(e);} };
export const listActivity    = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.ok(res, await svc.getActivity(req.params.id)); } catch(e){next(e);} };
export const listBugs        = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.ok(res, await svc.getBugIdsByCycle(req.params.id)); } catch(e){next(e);} };
export const allBugIds       = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.ok(res, await svc.getAllBugIdsInAnyCycle()); } catch(e){next(e);} };
export const uploadEvidence  = [upload.single("file"), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { if(!req.file){r.badRequest(res,"Arquivo obrigatório");return;} r.ok(res, await svc.addEvidenceFile(req.params.execId, req.file)); } catch(e){next(e);}
}];
export const deleteEvidence  = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => { try { r.ok(res, await svc.removeEvidenceFile(req.params.execId,req.params.fileId)); } catch(e){next(e);} };