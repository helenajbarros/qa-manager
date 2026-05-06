import { useState } from "react";
import { useAsync } from "../hooks/useAsync.js";
import { usersApi } from "../services/resources.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select } from "../components/UI.jsx";

const ROLE_OPTS = [
  { value: "admin",  label: "Admin — acesso total" },
  { value: "editor", label: "Editor — pode criar e editar" },
  { value: "viewer", label: "Visualizador — somente leitura" },
];
const ROLE_LABELS = { admin: "Admin", editor: "Editor", viewer: "Visualizador" };
const ROLE_COLORS = { admin: "var(--danger)", editor: "var(--accent)", viewer: "var(--text-muted)" };

function UserForm({ initial = {}, onSave, onCancel, saving, isEdit }) {
  const [form, setForm] = useState({
    name:     initial.name  || "",
    email:    initial.email || "",
    password: "",
    role:     initial.role  || "viewer",
    active:   initial.active !== undefined ? initial.active : 1,
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

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
          <Select value={form.role} onChange={(v) => setForm(f => ({ ...f, role: v }))}
            options={ROLE_OPTS} />
        </Field>
        {isEdit && (
          <Field label="Status">
            <Select value={String(form.active)}
              onChange={(v) => setForm(f => ({ ...f, active: Number(v) }))}
              options={[{ value: "1", label: "Ativo" }, { value: "0", label: "Inativo" }]} />
          </Field>
        )}
      </div>
      <div style={{ background: "var(--bg)", borderRadius: 6, padding: "10px 12px",
        fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
        <strong>Permissões:</strong><br />
        🔴 <strong>Admin</strong> — gerencia usuários, edita e exclui tudo<br />
        🔵 <strong>Editor</strong> — cria e edita testes, ciclos e bugs<br />
        ⚫ <strong>Visualizador</strong> — somente leitura (sem edição)
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

export default function Users() {
  const { user: me } = useAuth();
  const { data: users, loading, error, refetch } = useAsync(() => usersApi.list());
  const [modal,   setModal]   = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

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
        <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
          + Novo usuário
        </button>
      </div>

      {err && <ErrorMsg msg={err} />}

      <div className="card">
        {!users?.length ? (
          <Empty icon="👥" text="Nenhum usuário cadastrado." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Criado em</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>
                      {u.name}
                      {u.id === me?.id && (
                        <span style={{ fontSize: 10, marginLeft: 6, color: "var(--accent)",
                          background: "var(--accent-bg)", padding: "1px 6px", borderRadius: 10 }}>
                          você
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{u.email}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 500, color: ROLE_COLORS[u.role] }}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.active ? "badge-passed" : "badge-closed"}`}>
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm"
                          onClick={() => setModal({ mode: "edit", item: u })}>✏ Editar</button>
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
          <UserForm initial={modal.item || {}} onSave={handleSave}
            onCancel={() => setModal(null)} saving={saving} isEdit={modal.mode === "edit"} />
        </Modal>
      )}

      {confirm && (
        <ConfirmModal message={`Excluir o usuário "${confirm.name}"?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
