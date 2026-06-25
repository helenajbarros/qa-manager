import type { Request } from "express";

// ── Roles ────────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "editor" | "viewer";

// ── Entidades de banco ───────────────────────────────────────
export interface DbUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  active: number;
  default_project_id?: number | null;
  created_by_id?: number | null;
  created_at?: string;
}

export interface DbProject {
  id: number;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  created_by_id?: number | null;
  created_at?: string;
}

export interface DbModule {
  id: number;
  name: string;
  project_id: number;
  description?: string | null;
  created_at?: string;
}

export interface DbTestCase {
  id: number;
  title: string;
  description?: string | null;
  steps?: string | null;
  expected_result?: string | null;
  module_id?: number | null;
  project_id: number;
  status: string;
  test_type?: string | null;
  assigned_to_id?: number | null;
  created_by_id?: number | null;
  created_at?: string;
}

export interface DbCycle {
  id: number;
  name: string;
  description?: string | null;
  project_id: number;
  status: string;
  assigned_to_id?: number | null;
  created_by_id?: number | null;
  created_at?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface DbBug {
  id: number;
  title: string;
  description?: string | null;
  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  severity: string;
  status: string;
  project_id: number;
  module_id?: number | null;
  test_case_id?: number | null;
  cycle_id?: number | null;
  assigned_to_id?: number | null;
  created_by_id?: number | null;
  created_at?: string;
  updated_at?: string;
  test_type?: string | null;
}

export interface DbComment {
  id: number;
  bug_id: number;
  user_id: number;
  user_name?: string;
  text: string;
  created_at: string;
  updated_at?: string;
}

export interface DbNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string | null;
  created_at: string;
}

// ── Request autenticado ──────────────────────────────────────
export interface AuthUser {
  id: number;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ── Respostas padrão ─────────────────────────────────────────
export interface ApiOk<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResult<T> = ApiOk<T> | ApiError;

// ── Paginação ────────────────────────────────────────────────
export interface QueryFilters {
  project_id?: string | number;
  module_id?: string | number;
  status?: string;
  severity?: string;
  assigned_to_id?: string | number;
  search?: string;
  page?: string | number;
  limit?: string | number;
}
