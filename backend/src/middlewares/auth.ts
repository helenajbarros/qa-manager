import type { Request, Response, NextFunction } from "express";
import type { AuthRequest, UserRole } from "../types/index";
import { verifyToken } from "../services/usersService";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) { res.status(401).json({ success: false, error: "Não autenticado" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ success: false, error: "Token inválido ou expirado" }); return; }
  (req as AuthRequest).user = payload as { id: number; role: UserRole };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthRequest).user?.role !== "admin") {
    res.status(403).json({ success: false, error: "Acesso negado. Apenas admins." }); return;
  }
  next();
}

export function requireAdminOrManager(req: Request, res: Response, next: NextFunction): void {
  if (!["admin", "manager"].includes((req as AuthRequest).user?.role ?? "")) {
    res.status(403).json({ success: false, error: "Acesso negado." }); return;
  }
  next();
}

export function requireEditor(req: Request, res: Response, next: NextFunction): void {
  if (!["admin", "manager", "editor"].includes((req as AuthRequest).user?.role ?? "")) {
    res.status(403).json({ success: false, error: "Acesso negado. Apenas editores ou admins." }); return;
  }
  next();
}