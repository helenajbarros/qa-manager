import { api, getApiBase } from "./api.js";
import type {
  User, MentionUser, Project, Module,
  TestCase, TestCaseFilters,
  Cycle, CycleFilters, Execution,
  Bug, BugFilters,
  DashboardData, Notification, LoginResponse,
} from "../types/index.js";

function qs(p?: Record<string, unknown>): string {
  return p && Object.keys(p).length ? `?${new URLSearchParams(p as Record<string, string>)}` : "";
}

function getToken(): string | null {
  return localStorage.getItem("qa_token");
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/users/login", { email, password }),
  me: () => api.get<User>("/users/me"),
};

export const usersApi = {
  list:     ()              => api.get<User[]>("/users"),
  mentions: ()              => api.get<MentionUser[]>("/users/mentions"),
  create:   (d: Partial<User>) => api.post<User>("/users", d),
  update:   (id: number, d: Partial<User>) => api.put<User>(`/users/${id}`, d),
  delete:   (id: number)   => api.delete<void>(`/users/${id}`),
};

export const projectsApi = {
  list:   ()                      => api.get<Project[]>("/projects"),
  get:    (id: number)            => api.get<Project>(`/projects/${id}`),
  create: (d: Partial<Project>)   => api.post<Project>("/projects", d),
  update: (id: number, d: Partial<Project>) => api.put<Project>(`/projects/${id}`, d),
  delete: (id: number)            => api.delete<void>(`/projects/${id}`),
  uploadLogo: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("logo", file);
    const token = getToken();
    return fetch(`${getApiBase()}/projects/${id}/logo`, {
      method: "POST",
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json()).then(j => (j.data ?? j) as Project);
  },
};

export const modulesApi = {
  list:   (p?: Record<string, unknown>) => api.get<Module[]>(`/modules${qs(p)}`),
  create: (d: Partial<Module>)          => api.post<Module>("/modules", d),
  update: (id: number, d: Partial<Module>) => api.put<Module>(`/modules/${id}`, d),
  delete: (id: number)                  => api.delete<void>(`/modules/${id}`),
};

export const testCasesApi = {
  list:        (p?: TestCaseFilters)   => api.get<TestCase[]>(`/test-cases${qs(p as Record<string, unknown>)}`),
  get:         (id: number)            => api.get<TestCase>(`/test-cases/${id}`),
  create:      (d: Partial<TestCase>)  => api.post<TestCase>("/test-cases", d),
  update:      (id: number, d: Partial<TestCase>) => api.put<TestCase>(`/test-cases/${id}`, d),
  delete:      (id: number)            => api.delete<void>(`/test-cases/${id}`),
  getActivity: (id: number)            => api.get<unknown[]>(`/test-cases/${id}/activity`),
};

export const cyclesApi = {
  list:            (p?: CycleFilters)           => api.get<Cycle[]>(`/cycles${qs(p as Record<string, unknown>)}`),
  get:             (id: number)                 => api.get<Cycle>(`/cycles/${id}`),
  create:          (d: Partial<Cycle>)          => api.post<Cycle>("/cycles", d),
  update:          (id: number, d: Partial<Cycle>) => api.put<Cycle>(`/cycles/${id}`, d),
  delete:          (id: number)                 => api.delete<void>(`/cycles/${id}`),
  listExecutions:  (id: number)                 => api.get<Execution[]>(`/cycles/${id}/executions`),
  addExecutions:   (id: number, ids: number[])  => api.post<Execution[]>(`/cycles/${id}/executions`, { test_case_ids: ids }),
  updateExecution: (id: number, eid: number, d: Partial<Execution>) => api.put<Execution>(`/cycles/${id}/executions/${eid}`, d),
  deleteExecution: (id: number, eid: number)    => api.delete<void>(`/cycles/${id}/executions/${eid}`),
  getActivity:     (id: number)                 => api.get<unknown[]>(`/cycles/${id}/activity`),
  getBugs:         (id: number)                 => api.get<Bug[]>(`/cycles/${id}/bugs`),
};

export const bugsApi = {
  list:           (p?: BugFilters)           => api.get<Bug[]>(`/bugs${qs(p as Record<string, unknown>)}`),
  get:            (id: number)              => api.get<Bug>(`/bugs/${id}`),
  create:         (d: Partial<Bug>)         => api.post<Bug>("/bugs", d),
  update:         (id: number, d: Partial<Bug>) => api.put<Bug>(`/bugs/${id}`, d),
  delete:         (id: number)              => api.delete<void>(`/bugs/${id}`),
  addRelation:    (id: number, relId: number) => api.post<void>(`/bugs/${id}/relations`, { related_bug_id: relId }),
  removeRelation: (id: number, relId: number) => api.delete<void>(`/bugs/${id}/relations/${relId}`),
};

export const dashboardApi = {
  get: (p?: Record<string, unknown>) => api.get<DashboardData>(`/dashboard${qs(p)}`),
};

export const notificationsApi = {
  list:        ()           => api.get<Notification[]>("/notifications"),
  markRead:    (id: number) => api.put<void>(`/notifications/${id}/read`, {}),
  markAllRead: ()           => api.put<void>("/notifications/read-all", {}),
};

export const backupApi = {
  download: () => api.get<unknown>("/backup/download"),
  restore: (file: File) => {
    const fd = new FormData();
    fd.append("backup", file);
    const token = getToken();
    return fetch(`${getApiBase()}/backup/restore`, {
      method: "POST",
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json()).then(j => j.data ?? j);
  },
};
