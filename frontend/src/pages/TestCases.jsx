import { useState } from "react";
import { useAsync }    from "../hooks/useAsync.js";
import { testCasesApi, modulesApi, usersApi } from "../services/resources.js";
import { useProject }  from "../context/ProjectContext.jsx";
import { useAuth }     from "../context/AuthContext.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select, Priority } from "../components/UI.jsx";

const PRI_OPTS = [
  {value:"low",label:"Baixa"},{value:"medium",label:"Média"},
  {value:"high",label:"Alta"},{value:"critical",label:"Crítica"}
];
const PAGE_SIZE = 10;

function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"12px 0 0",fontSize:12,color:"var(--text-muted)"}}>
      <span>{total} item(s) — Página {page} de {totalPages}</span>
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

function TestCaseForm({ initial={}, modules, users, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    module_id:       initial.module_id       || "",
    title:           initial.title           || "",
    description:     initial.description     || "",
    preconditions:   initial.preconditions   || "",
    steps:           initial.steps           || "",
    expected_result: initial.expected_result || "",
    priority:        initial.priority        || "medium",
    assigned_to_id:  initial.assigned_to_id  || "",
  });
  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));
  return (
    <>
      <div className="form-row">
        <Field label="Módulo *">
          <Select value={form.module_id} onChange={v => setForm(f=>({...f,module_id:v}))}
            options={modules.map(m=>({value:m.id,label:m.name}))} placeholder="Selecione..." />
        </Field>
        <Field label="Prioridade">
          <Select value={form.priority} onChange={v => setForm(f=>({...f,priority:v}))} options={PRI_OPTS} />
        </Field>
      </div>
      <Field label="Título *">
        <input value={form.title} onChange={set("title")} autoFocus placeholder="Ex: Login com credenciais válidas" />
      </Field>
      <Field label="Responsável pelo teste">
        <Select value={form.assigned_to_id} onChange={v => setForm(f=>({...f,assigned_to_id:v}))}
          options={users.map(u=>({value:u.id,label:u.name}))} placeholder="Não atribuído" />
      </Field>
      <Field label="Descrição">
        <textarea value={form.description} onChange={set("description")} placeholder="Objetivo do teste..." />
      </Field>
      <Field label="Pré-condições">
        <textarea value={form.preconditions} onChange={set("preconditions")} placeholder="O que precisa estar configurado..." />
      </Field>
      <Field label="Passos">
        <textarea value={form.steps} onChange={set("steps")} style={{minHeight:100}}
          placeholder="1. Acesse a página&#10;2. Clique em..." />
      </Field>
      <Field label="Resultado esperado">
        <textarea value={form.expected_result} onChange={set("expected_result")} placeholder="O que deve acontecer..." />
      </Field>
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}
          disabled={saving || !form.title.trim() || !form.module_id}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}

export default function TestCases() {
  const { currentProject } = useProject();
  const { user }           = useAuth();
  const pid      = currentProject?.id;
  const isViewer = user?.role === "viewer";

  const { data: casesRaw,  loading:l1, error:e1, refetch } = useAsync(() => testCasesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: modules,   loading:l2, error:e2 }          = useAsync(() => modulesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: usersRaw }                                  = useAsync(() => usersApi.mentions());
  const cases = casesRaw?.data ?? casesRaw;
  const users = usersRaw?.data ?? usersRaw;

  const [modal,     setModal]     = useState(null);
  const [confirm,   setConfirm]   = useState(null);
  const [detail,    setDetail]    = useState(null);
  const [search,    setSearch]    = useState("");
  const [filterMod, setFilterMod] = useState("");
  const [filterPri, setFilterPri] = useState("");
  const [page,      setPage]      = useState(1);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState(null);

  if (l1||l2) return <Loading />;
  if (e1||e2) return <ErrorMsg msg={e1||e2} />;

  const filtered = (cases||[]).filter(c => {
    if (filterMod && String(c.module_id) !== filterMod) return false;
    if (filterPri && c.priority !== filterPri)           return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
        !String(c.id).includes(search)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function handleFilterChange(fn) {
    fn();
    setPage(1);
  }

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      if (modal.mode==="create") await testCasesApi.create(form);
      else                        await testCasesApi.update(modal.item.id, form);
      setModal(null); refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try { await testCasesApi.delete(id); setConfirm(null); refetch(); }
    catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Casos de Teste</h1>
        {!isViewer && (
          <button className="btn btn-primary" onClick={() => setModal({mode:"create"})}>+ Novo caso</button>
        )}
      </div>
      {err && <ErrorMsg msg={err} />}

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Buscar por título ou ID..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,minWidth:200,flex:1}} />
        <select value={filterMod} onChange={e=>{ setFilterMod(e.target.value); setPage(1); }}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
          <option value="">Todos os módulos</option>
          {(modules||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filterPri} onChange={e=>{ setFilterPri(e.target.value); setPage(1); }}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
          <option value="">Todas as prioridades</option>
          {PRI_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{fontSize:12,color:"var(--text-muted)",alignSelf:"center"}}>{filtered.length} caso(s)</span>
      </div>

      <div className="card">
        {!filtered.length ? <Empty icon="📋" text="Nenhum caso encontrado." /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ID</th><th>Título</th><th>Módulo</th><th>Prioridade</th><th>Responsável</th><th>Criado em</th><th></th></tr>
                </thead>
                <tbody>
                  {paged.map(c => (
                    <tr key={c.id}>
                      <td>
                        <button onClick={() => setDetail(c)}
                          style={{background:"none",border:"none",cursor:"pointer",
                            color:"var(--accent)",fontWeight:700,fontSize:13,padding:0}}>
                          {c.id}
                        </button>
                      </td>
                      <td style={{fontWeight:500,maxWidth:280}}>
                        <button onClick={() => setDetail(c)}
                          style={{background:"none",border:"none",cursor:"pointer",
                            color:"var(--text)",textAlign:"left",fontSize:13,padding:0}}>
                          {c.title}
                        </button>
                      </td>
                      <td><span className="badge badge-active">{c.module_name}</span></td>
                      <td><Priority v={c.priority} /></td>
                      <td style={{fontSize:12,color:"var(--text-muted)"}}>{c.assigned_to_name||"—"}</td>
                      <td style={{color:"var(--text-muted)"}}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                      <td>
                        {!isViewer && (
                          <div className="actions">
                            <button className="btn btn-sm" onClick={() => setModal({mode:"edit",item:c})}>✏</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setConfirm(c)}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
          </>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDetail(null)}>
          <div className="modal" style={{maxWidth:600}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:4}}>
                  ID #{detail.id} — {detail.module_name}
                </div>
                <h3 style={{margin:0}}>{detail.title}</h3>
              </div>
              <Priority v={detail.priority} />
            </div>
            {detail.assigned_to_name && (
              <div style={{background:"var(--accent-bg)",borderRadius:6,padding:"6px 12px",
                fontSize:12,color:"var(--accent)",marginBottom:12}}>
                👤 Responsável: <strong>{detail.assigned_to_name}</strong>
              </div>
            )}
            {[
              {label:"Descrição",value:detail.description},
              {label:"Pré-condições",value:detail.preconditions},
              {label:"Passos",value:detail.steps},
              {label:"Resultado esperado",value:detail.expected_result},
            ].map(({label,value}) => value ? (
              <div key={label} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
                  textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{label}</div>
                <div style={{fontSize:13,whiteSpace:"pre-line",background:"var(--bg)",
                  padding:"8px 12px",borderRadius:6}}>{value}</div>
              </div>
            ) : null)}
            <div className="modal-footer">
              <button className="btn" onClick={() => setDetail(null)}>Fechar</button>
              {!isViewer && (
                <button className="btn btn-primary" onClick={() => { setModal({mode:"edit",item:detail}); setDetail(null); }}>✏ Editar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal.mode==="create"?"Novo caso de teste":"Editar caso"} onClose={() => setModal(null)}>
          <TestCaseForm initial={modal.item||{}} modules={modules||[]} users={users||[]}
            onSave={handleSave} onCancel={() => setModal(null)} saving={saving} />
        </Modal>
      )}
      {confirm && (
        <ConfirmModal message={`Excluir "${confirm.title}"?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
