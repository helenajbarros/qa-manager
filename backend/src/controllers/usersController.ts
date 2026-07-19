import { query, execute } from "../database/connection";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/usersService";
import * as r   from "../utils/response";

export const login = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { r.badRequest(res, "email e password obrigatórios"); return; }
    const result = await svc.login(email, password);
    if (!result) { res.status(401).json({ success: false, error: "Credenciais inválidas" }); return; }
    r.ok(res, result);
  } catch(e){next(e);}
};

export const me = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const u = await svc.findById(req.user!.id);
    u ? r.ok(res, u) : r.notFound(res, "Usuário");
  } catch(e){next(e);}
};

export const index = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, id } = req.user!;
    if (role === "admin") { r.ok(res, await svc.findAll()); }
    else {
      const users = await svc.findByCreator(id) as any[];
      r.ok(res, users.filter((u: any) => u.role !== "admin"));
    }
  } catch(e){next(e);}
};

export const show = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const u = await svc.findById(req.params.id) as any;
    if (!u) { r.notFound(res, "Usuário"); return; }
    if (req.user!.role !== "admin") {
      if (u.role === "admin") { res.status(403).json({ success: false, error: "Acesso negado" }); return; }
      if (String(req.params.id) !== String(req.user!.id) && String(u.created_by_id) !== String(req.user!.id)) {
        res.status(403).json({ success: false, error: "Acesso negado" }); return;
      }
    }
    r.ok(res, u);
  } catch(e){next(e);}
};

export const store = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) { r.badRequest(res, "name, email e password obrigatórios"); return; }
    if (req.user!.role !== "admin" && req.body.role === "admin") {
      res.status(403).json({ success: false, error: "Gerentes nao podem criar usuarios Admin" }); return;
    }
    r.created(res, await svc.create({ ...req.body, created_by_id: req.user!.id }));
  } catch(e){next(e);}
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const u = await svc.findById(req.params.id) as any;
    if (!u) { r.notFound(res, "Usuário"); return; }
    if (req.user!.role !== "admin") {
      if (u.role === "admin") { res.status(403).json({ success: false, error: "Acesso negado" }); return; }
      if (String(req.params.id) !== String(req.user!.id) && String(u.created_by_id) !== String(req.user!.id)) {
        res.status(403).json({ success: false, error: "Acesso negado" }); return;
      }
      if (req.body.role === "admin") { res.status(403).json({ success: false, error: "Gerentes nao podem atribuir perfil Admin" }); return; }
    }
    r.ok(res, await svc.update(req.params.id, req.body));
  } catch(e){next(e);}
};

export const destroy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (String(req.params.id) === String(req.user!.id)) { r.badRequest(res, "Nao pode excluir a si mesmo"); return; }
    const u = await svc.findById(req.params.id) as any;
    if (!u) { r.notFound(res, "Usuário"); return; }
    if (req.user!.role !== "admin") {
      if (u.role === "admin") { res.status(403).json({ success: false, error: "Acesso negado" }); return; }
      if (String(u.created_by_id) !== String(req.user!.id)) { res.status(403).json({ success: false, error: "Acesso negado" }); return; }
    }
    const x = await svc.remove(req.params.id);
    (x as any).changes === 0 ? r.notFound(res, "Usuário") : r.noContent(res);
  } catch(e){next(e);}
};

export const mentions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows = await svc.findAllForMentions();
    res.json({ success: true, data: rows });
  } catch(e){next(e);}
};

export const projectsController = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const svcProj = require("../services/projectsService");
    const multer  = require("multer");
    const rr      = require("../utils/response");
    const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });
    upload.single("logo")(req as any, res, async (err: any) => {
      if (err) { next(err); return; }
      try {
        if (!req.file) { rr.badRequest(res, "Arquivo não enviado"); return; }
        const data = await svcProj.saveLogo(req.params.id, req.file.buffer, req.file.mimetype);
        rr.ok(res, data);
   
   } catch(e){ next(e); }
    });
  } catch(e){next(e);}
};

export const getProjects = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows = await query<{project_id: number}>('SELECT project_id FROM user_projects WHERE user_id = $1', [req.params.id]);
    r.ok(res, rows.map(row => row.project_id));
  } catch(e){next(e);}
};

export const saveProjects = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { project_ids } = req.body;
    await execute('DELETE FROM user_projects WHERE user_id = $1', [req.params.id]);
    for (const pid of (project_ids || [])) {
      await execute('INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, pid]);
    }
    r.ok(res, { saved: true });
  } catch(e){next(e);}
};