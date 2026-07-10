import type { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  status?: number;
}

export default function errorHandler(
  err: AppError, req: Request, res: Response, _next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.path}`, err.message);
  if (err.status === 400) { res.status(400).json({ success: false, error: err.message }); return; }
  if (err.message?.includes("UNIQUE constraint") || err.message?.includes("duplicate key value") || (err as any).code === "23505") {
    // Mensagem específica para nome de projeto duplicado
    if (err.message?.includes("projects_name_key"))
      { res.status(409).json({ success: false, error: "Já existe um projeto com esse nome. Escolha um nome diferente." }); return; }
    res.status(409).json({ success: false, error: "Registro duplicado." }); return;
  }
  if (err.message?.includes("FOREIGN KEY constraint") || err.message?.includes("foreign key constraint"))
    { res.status(400).json({ success: false, error: "Referência inválida (chave estrangeira)." }); return; }
  res.status(500).json({ success: false, error: "Erro interno do servidor." });
}