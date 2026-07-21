import { useState, ChangeEvent } from "react";
import { useAsync }   from "../hooks/useAsync.js";
import { modulesApi } from "../services/resources.js";
import { useProject } from "../context/ProjectContext.js";
import { useAuth }    from "../context/AuthContext.js";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field } from "../components/UI.js";
import type { Module } from "../types/index.js";

interface ModuleWithCount extends Module {
  test_count?: number;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

interface ModuleFormData {
  name: string;
  description: string;
}

interface ModuleFormProps {
  initial?: Partial<ModuleWithCount>;
  onSave: (form: ModuleFormData) => void;
  onCancel: () => void;
  saving: boolean;
}

type ModalState = { mode: "create"; item?: null } | { mode: "edit"; item: ModuleWithCount };

const PAGE_SIZE = 10;

function Pagination({ page, totalPages, total, onChange, pageSize, onPageSizeChange }: PaginationProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"12px 0 0",fontSize:12,color:"var(--text-muted)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span>{total} módulo(s) — Página {page} de {totalPages}</span>
        {onPageSizeChange && <select value={pageSize} onChange={e=>{onPageSizeChange(Number(e.target.value))}}
          style={{fontSize:11,padding:"2px 6px",borderRadius:4,border:"1px solid var(--border)",background:"var(--card)",color:"var(--text)",cursor:"pointer"}}>
          {[10,25,50,999].map(s=><option key={s} value={s}>{s===999?"Todos":s}</option>)}
        </select>}
      </div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={()=>onChange(Math.max(1,page-1))} disabled={page===1}
          style={{padding:"3px 10px",borderRadius:6,border:"1px solid var(--border)",
            background:"none",cursor:page===1?"not-allowed":"pointer",
            color:page===1?"var(--text-muted)":"var(--text)",fontSize:12}}>← Anterior</button>
        {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
          <button key={p} onClick={()=>onChange(p)}
            style={{padding:"3px 8px",borderRadius:6,border:"1px solid var(--border)",
              background:p===page?"var(--accent)":"none",
              color:p===page?"white":"var(--text)",cursor:"pointer",fontSize:12,minWidth:28}}>
            {p}
          </button>
        ))}
        <button onClick={()=>onChange(Math.min(totalPages,page+1))} disabled={page===totalPages}
          style={{padding:"3px 10px",borderRadius:6,border:"1px solid var(--border)",
            background:"none",cursor:page===totalPages?"not-allowed":"pointer",
            color:page===totalPages?"var(--text-muted)":"var(--text)",fontSize:12}}>Próxima →</button>
      </div>
    </div>
  );
}

function ModuleForm({ initial = {}, onSave, onCancel, saving }: ModuleFormProps) {
  const [form, setForm] = useState({ name: initial.name||"", description: initial.description||"" });
  const set = (k: keyof ModuleFormData) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <>
      <Field label="Nome *"><input data-testid="input-modulo-nome" value={form.name} onChange={set("name")} placeholder="Ex: Login" autoFocus /></Field>
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
  const isViewer  = user?.role === "viewer";
  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: modules, loading, error, refetch } = useAsync(
    () => modulesApi.list(pid ? { project_id: pid } : {}), [pid]
  );
  const [modal,   setModal]   = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<ModuleWithCount | null>(null);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  const filtered = ((modules as ModuleWithCount[]) || []).filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged      = filtered.slice((page-1)*pageSize, page*pageSize);

  async function handleSave(form: ModuleFormData) {
    setSaving(true); setErr(null);
    try {
      if (modal.mode==="create") await modulesApi.create({...form, project_id: pid});
      else                        await modulesApi.update(modal.item.id, form);
      setModal(null); refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await modulesApi.delete(id); setConfirm(null); refetch(); }
    catch(e) { setConfirm(null); alert(e.message || "Não foi possível excluir o módulo."); }
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
        <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Buscar módulo..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,width:280}} />
      </div>
      <div className="card">
        {!filtered.length ? <Empty icon="🗂" text="Nenhum módulo encontrado." /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nome</th><th>Descrição</th><th>Casos</th><th>Criado em</th><th></th></tr></thead>
                <tbody>
                  {paged.map(m => (
                    <tr key={m.id}>
                      <td style={{fontWeight:500}}>{m.name}</td>
                      <td style={{color:"var(--text-muted)"}}>{m.description||"—"}</td>
                      <td><span className="badge badge-active">{m.test_count}</span></td>
                      <td style={{color:"var(--text-muted)"}}>{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                      <td>
                        {!isViewer && (
                          <div className="actions">
                            <button className="btn btn-sm" onClick={()=>setModal({mode:"edit",item:m})}>✏ Editar</button>
                            {canManage && (
                              <button className="btn btn-sm btn-danger" onClick={()=>setConfirm(m)}>🗑</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={p=>{setPage(p)}} pageSize={pageSize} onPageSizeChange={s=>{setPageSize(s);setPage(1)}} />
          </>
        )}
      </div>
      {modal && (
        <Modal title={modal.mode==="create"?"Novo módulo":"Editar módulo"} onClose={()=>setModal(null)}>
          <ModuleForm initial={modal.item||{}} onSave={handleSave} onCancel={()=>setModal(null)} saving={saving} />
        </Modal>
      )}
      {confirm && (
        <ConfirmModal message={`Excluir "${confirm.name}"? Esta ação não pode ser desfeita. Módulos com casos de teste vinculados não podem ser excluídos.`}
          onConfirm={()=>handleDelete(confirm.id)} onCancel={()=>setConfirm(null)} />
      )}
    </div>
  );
}

