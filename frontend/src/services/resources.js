import { api } from "./api.js";

const qs = (p) => p && Object.keys(p).length ? `?${new URLSearchParams(p)}` : "";

export const authApi = {
  login: (email, password) => api.post("/users/login", { email, password }),
  me:    ()                 => api.get("/users/me"),
};
export const usersApi = {
  list:   ()         => api.get("/users"),
  create: (d)        => api.post("/users", d),
  update: (id, d)    => api.put(`/users/${id}`, d),
  delete: (id)       => api.delete(`/users/${id}`),
};
export const projectsApi = {
  list:       ()         => api.get("/projects"),
  get:        (id)       => api.get(`/projects/${id}`),
  create:     (d)        => api.post("/projects", d),
  update:     (id, d)    => api.put(`/projects/${id}`, d),
  delete:     (id)       => api.delete(`/projects/${id}`),
  uploadLogo: (id, file) => {
    const fd = new FormData(); fd.append("logo", file);
    const token = localStorage.getItem("qa_token");
    return fetch(`/api/projects/${id}/logo`, {
      method: "POST", body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json()).then(j => j.data ?? j);
  },
};
export const modulesApi = {
  list:   (p)        => api.get(`/modules${qs(p)}`),
  create: (d)        => api.post("/modules", d),
  update: (id, d)    => api.put(`/modules/${id}`, d),
  delete: (id)       => api.delete(`/modules/${id}`),
};
export const testCasesApi = {
  list:   (p)        => api.get(`/test-cases${qs(p)}`),
  get:    (id)       => api.get(`/test-cases/${id}`),
  create: (d)        => api.post("/test-cases", d),
  update: (id, d)    => api.put(`/test-cases/${id}`, d),
  delete: (id)       => api.delete(`/test-cases/${id}`),
};
export const cyclesApi = {
  list:            (p)         => api.get(`/cycles${qs(p)}`),
  get:             (id)        => api.get(`/cycles/${id}`),
  create:          (d)         => api.post("/cycles", d),
  update:          (id, d)     => api.put(`/cycles/${id}`, d),
  delete:          (id)        => api.delete(`/cycles/${id}`),
  listExecutions:  (id)        => api.get(`/cycles/${id}/executions`),
  addExecutions:   (id, ids)   => api.post(`/cycles/${id}/executions`, { test_case_ids: ids }),
  updateExecution: (id, eid, d)=> api.put(`/cycles/${id}/executions/${eid}`, d),
  deleteExecution: (id, eid)   => api.delete(`/cycles/${id}/executions/${eid}`),
};
export const bugsApi = {
  list:   (p)        => api.get(`/bugs${qs(p)}`),
  create: (d)        => api.post("/bugs", d),
  update: (id, d)    => api.put(`/bugs/${id}`, d),
  delete: (id)       => api.delete(`/bugs/${id}`),
};
export const dashboardApi = {
  get: (p) => api.get(`/dashboard${qs(p)}`),
};
