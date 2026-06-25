import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/bugsService";
import * as r   from "../utils/response";
import path     from "path";
import multer   from "multer";

const storage = multer.diskStorage({
  destination: (_: any, __: any, cb: any) => cb(null, process.env.QA_UPLOAD_DIR || "uploads"),
  filename:    (_: any, file: any, cb: any) => cb(null, `bug-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export const index = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await svc.findAll(req.query as any);
    if (result && (result as any).data) {
      res.json({ success: true, data: (result as any).data, total: (result as any).total, page: (result as any).page, pages: (result as any).pages });
    } else {
      r.ok(res, result);
    }
  } catch(e) { next(e); }
};

export const show = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const x        = await svc.findById(req.params.id);
    const activity = await svc.getActivity(req.params.id);
    x ? r.ok(res, { ...x, activity }) : r.notFound(res, "Bug");
  } catch(e) { next(e); }
};

export const store = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.title?.trim()) { r.badRequest(res, "title obrigatório"); return; }
    r.created(res, await svc.create(req.body));
  } catch(e) { next(e); }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if ("title" in req.body && !req.body.title?.trim()) { r.badRequest(res, "title obrigatório"); return; }
    const existing = await svc.findById(req.params.id);
    if (!existing) { r.notFound(res, "Bug"); return; }
    const merged = { ...existing, ...req.body };
    r.ok(res, await svc.update(req.params.id, merged, req.user?.id));
  } catch(e) { next(e); }
};

export const destroy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const x = await svc.remove(req.params.id);
    (x as any).changes === 0 ? r.notFound(res, "Bug") : r.noContent(res);
  } catch(e) { next(e); }
};

export const uploadFile = [
  upload.single("file"),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) { r.badRequest(res, "Arquivo obrigatório"); return; }
      r.ok(res, await svc.addFile(req.params.id, req.file));
    } catch(e) { next(e); }
  }
];

export const deleteFile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.removeFile(req.params.id, req.params.fileId)); } catch(e) { next(e); }
};

export const addRelation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { related_bug_id } = req.body;
    if (!related_bug_id) { r.badRequest(res, "related_bug_id obrigatório"); return; }
    r.ok(res, await svc.addRelation(req.params.id, related_bug_id));
  } catch(e) { next(e); }
};

export const removeRelation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try { r.ok(res, await svc.removeRelation(req.params.id, req.params.relatedId)); } catch(e) { next(e); }
};