import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index";
import * as svc from "../services/dashboardService";
import * as r   from "../utils/response";
import { getUserProjectIds } from "../services/userProjectsService";
import { query } from "../database/connection";

async function canAccessProject(user: { id: number; role: string }, projectId: string | undefined): Promise<boolean> {
  if (!projectId) return true;
  if (user.role === "admin") return true;
  if (user.role === "manager") {
    const rows = await query("SELECT id FROM projects WHERE id=$1 AND created_by_id=$2", [projectId, user.id]);
    if ((rows as any[]).length > 0) return true;
  }
  const ids = await getUserProjectIds(user.id, user.role);
  return ((ids as any[]) || []).map(Number).includes(Number(projectId));
}

export const index = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { project_id } = req.query as { project_id?: string };
    if (project_id && req.user && !(await canAccessProject(req.user, project_id))) {
      res.status(403).json({ success: false, error: "Sem acesso a este projeto" }); return;
    }
    r.ok(res, await svc.getDashboard(req.query as any));
  } catch(e){next(e);}
};