import type { Response } from "express";

export const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};

export const created = (res: Response, data: unknown): void => ok(res, data, 201);

export const noContent = (res: Response): void => { res.status(204).send(); };

export const notFound = (res: Response, entity = "Recurso"): void => {
  res.status(404).json({ success: false, error: `${entity} não encontrado(a)` });
};

export const badRequest = (res: Response, message: string): void => {
  res.status(400).json({ success: false, error: message });
};

export const conflict = (res: Response, message: string): void => {
  res.status(409).json({ success: false, error: message });
};

export const serverError = (res: Response, err: unknown): void => {
  console.error(err);
  res.status(500).json({ success: false, error: "Erro interno do servidor" });
};