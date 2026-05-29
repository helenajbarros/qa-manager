import { useState } from "react";
import { useAsync } from "../hooks/useAsync.js";
import { usersApi, projectsApi } from "../services/resources.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select } from "../components/UI.jsx";

function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}
function getToken() { return localStorage.getItem("qa_token"); }

async function fetchUserProjects(userId) {
  const res = await fetch(`${getBase()}/users/${userId}/projects`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const json = await res.json();
  return json.data ?? json ?? [];
}

async function saveUserProjects(userId, projectIds) {
  await fetch(`${getBase()}/users/${userId}/projects`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ project_ids: projectIds }),
  });
}

const ROLE_OPTS = [
  { value: "admin",  label: "Admin — acesso total" },
  { value: "editor", label: "Editor — pode criar e editar" },
  { value: "viewer", label: "Visualizador — somente leitura" },
];
const ROLE_LABELS = { admin: "Admin", editor: "Editor", viewer: "Visualizador" };
const ROLE_COLORS = { admin: "var(--danger)", editor: "var(--accent)", viewer: "var(--text-muted)" };

function UserForm({ initial={}, onSave, onCancel, saving, isEdit }) {
  const [form, setForm] = useState({
    name:     initial.name  || "",
    email:    initial.email || "",
    password: "",
    role:     initial.role  || "viewer",
    active:   initial.active !== undefined ? initial.active : 1,
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <Field label="Nome completo *">
        <input value={form.name} onChange={set("name")} placeholder="Ex: João Silva" autoFocus />
      </Field>
      <Field label="E-mail *">
        <input type="email" value={form.email} onChange={set("email")} placeholder="joao@empresa.com" />
      </Field>
      <Field label={isEdit ? "Nova senha (deixe em branco para não alterar)" : "Senha *"}>
        <input type="password" value={form.password} onChange={set("password")}
          placeholder={isEdit ? "••••••••" : "Mínimo 6 caracteres"} />
      </Field>
      <div className="form-row">
        <Field label="Perfil de acesso">
          <Select value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} options={ROLE_OPTS} />
        </Field>
        {isEdit && (
          <Field label="Status">
            <Select value={String(form.active)}
              onChange={v => setForm(f => ({ ...f, active: Number(v) }))}
              options={[{ value:"1", label:"Ativo" }, { value:"0", label:"Inativo" }]} />
          </Field>
        )}
      </div>
      <div style={{ background:"var(--bg)", borderRadius:6, padding:"10px 12px",
        fontSize:12, color:"var(--text-muted)", marginBottom:4 }}>
        <strong>Permissões:</strong><br />
        🔴 <strong>Admin</strong> — acesso a todos os projetos, gerencia usuários<br />
        🔵 <strong>Editor</strong> — cria e edita nos projetos atribuídos<br />
        ⚫ <strong>Visualizador</strong> — somente leitura nos projetos atribuídos
      </div>
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.email.trim() ||
            (!isEdit && !form.password.trim())}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}

function ProjectAccessModal({ user, projects, onClose }) {
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useState(() => {
    fetchUserProjects(user.id).then(ids => {
      setSelected(ids.map(Number));
      setLoading(false);
    });
  }, [user.id]);

  function toggle(pid) {
    setSelected(s => s.includes(pid) ? s.filter(x => x !== pid) : [...s, pid]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveUserProjects(user.id, selected);
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`Projetos — ${user.name}`} onClose={onClose}>
      {loading ? <Loading /> : (
        <>
          <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, padding:"8px 12px",
            background:"var(--accent-bg)", borderRadius:6 }}>
            🔵 Selecione quais projetos <strong>{user.name}</strong> pode acessar.
            Admins têm acesso a todos os projetos automaticamente.
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {projects.map(p => (
              <label key={p.id} style={{
                display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                background: selected.includes(p.id) ? "var(--accent-bg)" : "var(--surface)",
                border: `1px solid ${selected.includes(p.id) ? "var(--accent)" : "var(--border)"}`,
                borderRadius:8, cursor:"pointer"
              }}>
                <input type="checkbox" checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  style={{ width:16, height:16, cursor:"pointer" }} />
                {p.logo_url && (
                  <img src={p.logo_url} alt="" style={{ width:28, height:28, borderRadius:6, objectFit:"cover" }} />
                )}
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
                  {p.description && <div style={{ fontSize:11, color:"var(--text-muted)" }}>{p.description}</div>}
                </div>
                {selected.includes(p.id) && (
                  <span style={{ marginLeft:"auto", fontSize:11, color:"var(--accent)", fontWeight:600 }}>✓ Permitido</span>
                )}
              </label>
            ))}
          </div>

          {projects.length === 0 && (
            <div style={{ textAlign:"center", color:"var(--text-muted)", padding:24 }}>
              Nenhum projeto cadastrado.
            </div>
          )}

          <div className="modal-footer">
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : `Salvar (${selected.length} projeto${selected.length !== 1 ? "s" : ""})`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { data: users,    loading:l1, error:e1, refetch } = useAsync(() => usersApi.list());
  const { data: projects, loading:l2 }                    = useAsync(() => projectsApi.list());

  const [modal,         setModal]         = useState(null);
  const [confirm,       setConfirm]       = useState(null);
  const [projectModal,  setProjectModal]  = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState(null);

  if (l1||l2) return <Loading />;
  if (e1)     return <ErrorMsg msg={e1} />;

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      const data = { ...form };
      if (modal.mode === "edit" && !data.password) delete data.password;
      if (modal.mode === "create") await usersApi.create(data);
      else                         await usersApi.update(modal.item.id, data);
      setModal(null); refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await usersApi.delete(id); setConfirm(null); refetch(); }
    catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Usuários & Permissões</h1>
        <button className="btn btn-primary" onClick={() => setModal({ mode:"create" })}>
          + Novo usuário
        </button>
      </div>

      {err && <ErrorMsg msg={err} />}

      <div className="card">
        {!users?.length ? <Empty icon="👥" text="Nenhum usuário cadastrado." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Projetos</th><th>Criado em</th><th></th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight:500 }}>
                      {u.name}
                      {u.id === me?.id && (
                        <span style={{ fontSize:10, marginLeft:6, color:"var(--accent)",
                          background:"var(--accent-bg)", padding:"1px 6px", borderRadius:10 }}>
                          você
                        </span>
                      )}
                    </td>
                    <td style={{ color:"var(--text-muted)" }}>{u.email}</td>
                    <td>
                      <span style={{ fontSize:12, fontWeight:500, color:ROLE_COLORS[u.role] }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.active ? "badge-passed" : "badge-closed"}`}>
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      {u.role === "admin" ? (
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>Todos</span>
                      ) : (
                        <button className="btn btn-sm"
                          onClick={() => setProjectModal(u)}
                          style={{ fontSize:11 }}>
                          🗂 Gerenciar
                        </button>
                      )}
                    </td>
                    <td style={{ color:"var(--text-muted)" }}>
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm"
                          onClick={() => setModal({ mode:"edit", item:u })}>✏ Editar</button>
                        {u.id !== me?.id && (
                          <button className="btn btn-sm btn-danger"
                            onClick={() => setConfirm(u)}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Novo usuário" : "Editar usuário"}
          onClose={() => setModal(null)}>
          <UserForm initial={modal.item||{}} onSave={handleSave}
            onCancel={() => setModal(null)} saving={saving} isEdit={modal.mode === "edit"} />
        </Modal>
      )}

      {confirm && (
        <ConfirmModal message={`Excluir o usuário "${confirm.name}"?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}

      {projectModal && (
        <ProjectAccessModal
          user={projectModal}
          projects={projects || []}
          onClose={() => setProjectModal(null)}
        />
      )}
    </div>
  );
}
