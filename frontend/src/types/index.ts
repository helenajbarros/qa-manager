// ─────────────────────────────────────────────────────────────
// Tipos centrais da aplicação QA Manager
// ─────────────────────────────────────────────────────────────

// ── Roles ────────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "editor" | "viewer";

// ── Entidades ────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  active: number;
  default_project_id?: number | null;
  created_by_id?: number | null;
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  created_by_id?: number | null;
  created_at?: string;
}

export interface Module {
  id: number;
  name: string;
  project_id: number;
  description?: string | null;
  created_at?: string;
}

export type TestCaseStatus = "ativo" | "rascunho" | "obsoleto";
export type TestType =
  | "Funcional"
  | "Regressão"
  | "Integração"
  | "Performance"
  | "Segurança"
  | "Usabilidade"
  | "Acessibilidade"
  | "API"
  | "UI"
  | "Outro";

export interface TestCase {
  id: number;
  title: string;
  description?: string | null;
  steps?: string | null;
  expected_result?: string | null;
  module_id?: number | null;
  module_name?: string | null;
  project_id: number;
  status: TestCaseStatus;
  test_type?: TestType | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  created_at?: string;
}

export type CycleStatus = "planejado" | "em_andamento" | "concluido" | "cancelado";
export type ExecutionStatus = "pendente" | "aprovado" | "reprovado" | "bloqueado" | "na";

export interface Cycle {
  id: number;
  name: string;
  description?: string | null;
  project_id: number;
  status: CycleStatus;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  created_at?: string;
  start_date?: string | null;
  end_date?: string | null;
  progress?: number;
  total?: number;
  passed?: number;
  failed?: number;
}

export interface Execution {
  id: number;
  cycle_id: number;
  test_case_id: number;
  test_case_title?: string;
  status: ExecutionStatus;
  notes?: string | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  executed_at?: string | null;
  evidence_files?: EvidenceFile[];
}

export type BugSeverity = "critico" | "alto" | "medio" | "baixo";
export type BugStatus =
  | "aberto"
  | "em_analise"
  | "em_correcao"
  | "aguardando_teste"
  | "resolvido"
  | "fechado"
  | "reaberto";

export interface Bug {
  id: number;
  title: string;
  description?: string | null;
  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  severity: BugSeverity;
  status: BugStatus;
  project_id: number;
  module_id?: number | null;
  module_name?: string | null;
  test_case_id?: number | null;
  test_case_title?: string | null;
  cycle_id?: number | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
  test_type?: TestType | null;
  evidence_files?: EvidenceFile[];
  related_bugs?: RelatedBug[];
}

export interface RelatedBug {
  id: number;
  related_bug_id: number;
  title: string;
  status: BugStatus;
}

export interface EvidenceFile {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  ref_type: "bug" | "execution";
  ref_id: number;
  created_at?: string;
}

export interface Comment {
  id: number;
  bug_id: number;
  user_id: number;
  user_name: string;
  text: string;
  created_at: string;
  updated_at?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string | null;
  created_at: string;
}

export interface MentionUser {
  id: number;
  name: string;
}

// ── Dashboard ────────────────────────────────────────────────
export interface DashboardData {
  total_bugs: number;
  open_bugs: number;
  resolved_bugs: number;
  critical_bugs: number;
  total_test_cases: number;
  total_cycles: number;
  active_cycles: number;
  bugs_by_severity: Array<{ severity: BugSeverity; count: number }>;
  bugs_by_status: Array<{ status: BugStatus; count: number }>;
  bugs_by_module: Array<{ module_name: string; count: number }>;
  recent_bugs: Bug[];
}

// ── API responses ────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ── Filtros ──────────────────────────────────────────────────
export interface BugFilters {
  project_id?: number;
  module_id?: number;
  status?: BugStatus;
  severity?: BugSeverity;
  assigned_to_id?: number;
  search?: string;
}

export interface TestCaseFilters {
  project_id?: number;
  module_id?: number;
  status?: TestCaseStatus;
  assigned_to_id?: number;
  search?: string;
}

export interface CycleFilters {
  project_id?: number;
  status?: CycleStatus;
}
