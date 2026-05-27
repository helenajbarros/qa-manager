import { useState } from "react";
import { useAsync }   from "../hooks/useAsync.js";
import { modulesApi } from "../services/resources.js";
import { useProject } from "../context/ProjectContext.jsx";
import { useAuth }    from "../context/AuthContext.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field } from "../components/UI.jsx";

function ModuleForm({ initial={}, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ name: initial.name||"", description: initial.description||"" });
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  return (
    <>
      <Field label="Nome *"><input value={form.name} onChange={set("name")} placeholder="Ex: Login" autoFocus /></Field>
      <Field label="Descrição"><textarea value={form.description} onChange={set("description")} placeholder="Descrição do módulo..." /></Field>
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={()=>onSave(form)} disabled={saving||!form.name.trim()}>
          {saving?"Salvando…":"Salvar"}
        </button>
      </div>
    </>
  );
}

export default function Modules() {
  const { currentProject } = useProject();
  const { user }           = useAuth();
  const pid      = currentProject?.id;
  const isViewer = user?.role === "viewer";

  const { data: modules, loading, error, refetch } = useAsync(
    () => modulesApi.list(pid ? { project_id: pid } : {}), [pid]
  );
  const [modal,   setModal]   = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search,  setSearch]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  const filtered = (modules||[]).filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      if (modal.mode==="create") await modulesApi.create({...form, project_id: pid});
      else                        await modulesApi.update(modal.item.id, form);
      setModal(null); refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await modulesApi.delete(id); setConfirm(null); refetch(); }
    catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Módulos</h1>
        {!isViewer && (
          <button className="btn btn-primary" onClick={()=>setModal({mode:"create"})}>+ Novo módulo</button>
        )}
      </div>
      {err && <ErrorMsg msg={err} />}
      <div style={{marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Buscar módulo..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,width:280}} />
      </div>
      <div className="card">
        {!filtered.length ? <Empty icon="🗂" text="Nenhum módulo encontrado." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Descrição</th><th>Casos</th><th>Criado em</th><th></th></tr></thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td style={{fontWeight:500}}>{m.name}</td>
                    <td style={{color:"var(--text-muted)"}}>{m.description||"—"}</td>
                    <td><span className="badge badge-active">{m.test_count}</span></td>
                    <td style={{color:"var(--text-muted)"}}>{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                    <td>
                      {!isViewer && (
                        <div className="actions">
                          <button className="btn btn-sm" onClick={()=>setModal({mode:"edit",item:m})}>✏ Editar</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>setConfirm(m)}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && (
        <Modal title={modal.mode==="create"?"Novo módulo":"Editar módulo"} onClose={()=>setModal(null)}>
          <ModuleForm initial={modal.item||{}} onSave={handleSave} onCancel={()=>setModal(null)} saving={saving} />
        </Modal>
      )}
      {confirm && (
        <ConfirmModal message={`Excluir "${confirm.name}"? Os casos de teste serão removidos.`}
          onConfirm={()=>handleDelete(confirm.id)} onCancel={()=>setConfirm(null)} />
      )}
    </div>
  );
}
