import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/testCasesService";
import * as r   from "../utils/response";
import * as XLSX from "xlsx";

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

export const parseExcel = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: "Nenhum arquivo enviado" }); return; }
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    const columns = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
    const preview = jsonRows.slice(0, 5);
    r.ok(res, { columns, preview, total: jsonRows.length });
  } catch(e){next(e);}
};

export const importExcel = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: "Nenhum arquivo enviado" }); return; }
    const { project_id, mapping } = req.body;
    if (!project_id || !mapping) { res.status(400).json({ success: false, message: "project_id e mapping são obrigatórios" }); return; }
    const parsedMapping = typeof mapping === "string" ? JSON.parse(mapping) : mapping;
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    const result = await svc.importFromExcel(project_id, jsonRows, parsedMapping, req.user?.id);
    r.ok(res, result);
  } catch(e){next(e);}
};