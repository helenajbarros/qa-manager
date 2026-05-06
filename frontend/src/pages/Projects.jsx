import { useState, useRef } from "react";
import { useAsync }     from "../hooks/useAsync.js";
import { projectsApi }  from "../services/resources.js";
import { useProject }   from "../context/ProjectContext.jsx";
import { useAuth }      from "../context/AuthContext.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field } from "../components/UI.jsx";

function ProjectForm({ initial={}, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ name: initial.name||"", description: initial.description||"" });
  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));
  return (
    <>
      <Field label="Nome *"><input value={form.name} onChange={set("name")} autoFocus placeholder="Ex: Portal do Cliente" /></Field>
      <Field label="Descrição"><textarea value={form.description} onChange={set("description")} placeholder="Descrição do projeto..." /></Field>
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving||!form.name.trim()}>
          {saving?"Salvando…":"Salvar"}
        </button>
      </div>
    </>
  );
}

export default function Projects() {
  const { data: projects, loading, error, refetch } = useAsync(() => projectsApi.list());
  const { refreshProjects, selectProject } = useProject();
  const { isAdmin } = useAuth();
  const [modal,   setModal]   = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);
  const logoInputRef = useRef({});

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      if (modal.mode === "create") await projectsApi.create(form);
      else                         await projectsApi.update(modal.item.id, form);
      setModal(null); refetch(); refreshProjects();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await projectsApi.delete(id); setConfirm(null); refetch(); refreshProjects(); }
    catch(e) { setErr(e.message); }
  }

  async function handleLogoUpload(projectId, file) {
    try { await projectsApi.uploadLogo(projectId, file); refetch(); refreshProjects(); }
    catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projetos</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setModal({ mode:"create" })}>
            + Novo projeto
          </button>
        )}
      </div>
      {err && <ErrorMsg msg={err} />}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
        {!projects?.length
          ? <Empty icon="🗃" text="Nenhum projeto cadastrado." />
          : projects.map(p => (
            <div key={p.id} className="card" style={{ cursor:"pointer" }}
              onClick={() => selectProject(p.id)}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                {p.logo_url
                  ? <img src={`/uploads/${p.logo_url}`} alt="logo"
                      style={{ width:48, height:48, objectFit:"cover", borderRadius:8,
                        border:"1px solid var(--border)" }} />
                  : <div style={{ width:48, height:48, borderRadius:8, background:"var(--accent-bg)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🗃</div>
                }
                <div>
                  <div style={{ fontWeight:600, fontSize:15 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>{p.description||"—"}</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--text-muted)", marginBottom:12 }}>
                <span>🗂 {p.module_count} módulos</span>
                <span>🔁 {p.cycle_count} ciclos</span>
                <span>🐛 {p.bug_count} bugs</span>
              </div>

              <span className={`badge ${p.active ? "badge-passed":"badge-closed"}`}>
                {p.active ? "Ativo":"Inativo"}
              </span>

              {isAdmin && (
                <div className="actions" style={{ marginTop:12 }} onClick={e => e.stopPropagation()}>
                  <label style={{ cursor:"pointer" }} title="Trocar logo">
                    <span className="btn btn-sm">🖼 Logo</span>
                    <input type="file" style={{ display:"none" }} accept="image/*"
                      onChange={e => { if(e.target.files[0]) handleLogoUpload(p.id, e.target.files[0]); e.target.value=""; }} />
                  </label>
                  <button className="btn btn-sm" onClick={() => setModal({ mode:"edit", item:p })}>✏ Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirm(p)}>🗑</button>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {modal && (
        <Modal title={modal.mode==="create"?"Novo projeto":"Editar projeto"} onClose={() => setModal(null)}>
          <ProjectForm initial={modal.item||{}} onSave={handleSave} onCancel={() => setModal(null)} saving={saving} />
        </Modal>
      )}
      {confirm && (
        <ConfirmModal message={`Excluir o projeto "${confirm.name}" e todos os seus dados?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
