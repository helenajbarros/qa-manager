import { useState } from "react";
import { useAsync }    from "../hooks/useAsync.js";
import { bugsApi, modulesApi, testCasesApi } from "../services/resources.js";
import { useAuth }     from "../context/AuthContext.jsx";
import { useProject }  from "../context/ProjectContext.jsx";
import { FileUpload }  from "../components/FileUpload.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select, Severity, BugStatus } from "../components/UI.jsx";

const SEV_OPTS    = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const STATUS_OPTS = [{value:"open",label:"Aberto"},{value:"in_progress",label:"Em andamento"},{value:"fixed",label:"Corrigido"},{value:"closed",label:"Fechado"}];

function BugForm({ initial={}, modules, testCases, onSave, onCancel, saving, bugId, onFileUpload, onFileDelete }) {
  const [form, setForm] = useState({
    title:        initial.title        || "",
    description:  initial.description  || "",
    comment:      initial.comment      || "",
    tracker_url:  initial.tracker_url  || "",
    severity:     initial.severity     || "medium",
    status:       initial.status       || "open",
    module_id:    initial.module_id    || "",
    test_case_id: initial.test_case_id || "",
  });
  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  return (
    <>
      <Field label="Título *">
        <input value={form.title} onChange={set("title")} autoFocus
          placeholder="Ex: [Login] Botão Entrar não responde no Safari" />
      </Field>
      <p style={{fontSize:11,color:"var(--text-muted)",marginTop:-8,marginBottom:12}}>
        💡 Use [NomeDoMódulo] no título para vincular automaticamente.
      </p>
      <div className="form-row">
        <Field label="Severidade">
          <Select value={form.severity} onChange={v=>setForm(f=>({...f,severity:v}))} options={SEV_OPTS} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={STATUS_OPTS} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Módulo">
          <Select value={form.module_id} onChange={v=>setForm(f=>({...f,module_id:v}))}
            options={modules.map(m=>({value:m.id,label:m.name}))} placeholder="Automático pelo título..." />
        </Field>
        <Field label="Caso de teste vinculado">
          <Select value={form.test_case_id} onChange={v=>setForm(f=>({...f,test_case_id:v}))}
            options={testCases.map(t=>({value:t.id,label:`#${t.id} ${t.title}`}))} placeholder="Nenhum" />
        </Field>
      </div>
      <Field label="Link do tracker (ClickUp, Jira, etc)">
        <input value={form.tracker_url} onChange={set("tracker_url")}
          placeholder="https://app.clickup.com/t/..." />
      </Field>
      <Field label="Comentário">
        <textarea value={form.comment} onChange={set("comment")}
          placeholder="Passos para reproduzir, ambiente afetado..." rows={3} />
      </Field>
      <Field label="Descrição">
        <textarea value={form.description} onChange={set("description")} placeholder="Detalhes adicionais..." />
      </Field>
      {bugId ? (
        <Field label="Arquivos / Evidências">
          <FileUpload files={initial.evidence_files || []} onUpload={onFileUpload} onDelete={onFileDelete} />
        </Field>
      ) : (
        <div style={{fontSize:12,color:"var(--text-muted)",padding:"8px 12px",
          background:"var(--bg)",borderRadius:6,marginBottom:14}}>
          💡 Você poderá anexar arquivos e evidências após salvar o bug.
        </div>
      )}
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)}
          disabled={saving || !form.title.trim()}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}

export default function Bugs() {
  const { user }           = useAuth();
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const isViewer = user?.role === "viewer";

  const { data: bugs,      loading:l1, error:e1, refetch } = useAsync(() => bugsApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: modules,   loading:l2, error:e2 }          = useAsync(() => modulesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: testCases }                                 = useAsync(() => testCasesApi.list(pid?{project_id:pid}:{}), [pid]);

  const [modal,     setModal]     = useState(null);
  const [confirm,   setConfirm]   = useState(null);
  const [search,    setSearch]    = useState("");
  const [filterSev, setFilterSev] = useState("");
  const [filterSt,  setFilterSt]  = useState("");
  const [filterMod, setFilterMod] = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState(null);

  if (l1||l2) return <Loading />;
  if (e1||e2) return <ErrorMsg msg={e1||e2} />;

  const filtered = (bugs||[]).filter(b => {
    if (filterSev && b.severity !== filterSev)           return false;
    if (filterSt  && b.status   !== filterSt)            return false;
    if (filterMod && String(b.module_id) !== filterMod)  return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) &&
        !(b.created_by_name||"").toLowerCase().includes(search.toLowerCase()) &&
        !String(b.id).includes(search)) return false;
    return true;
  });

  const counts = (bugs||[]).reduce((a,b) => ({...a, [b.status]:(a[b.status]||0)+1}), {});

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      if (modal.mode==="create") {
        const created = await bugsApi.create({...form, project_id:pid, created_by_id:user?.id});
        setModal({ mode:"edit", item: created });
      } else {
        const updated = await bugsApi.update(modal.item.id, form);
        setModal(m => ({...m, item: updated}));
      }
      refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(file) {
    const fd = new FormData(); fd.append("file", file);
    const token = localStorage.getItem("qa_token");
    const res = await fetch(`/api/bugs/${modal.item.id}/files`, {
      method:"POST", body:fd,
      headers: token ? {Authorization:`Bearer ${token}`} : {},
    });
    const json = await res.json();
    const files = json.data ?? json;
    setModal(m => ({...m, item: {...m.item, evidence_files: files}}));
    refetch();
  }

  async function handleFileDelete(fileId) {
    const token = localStorage.getItem("qa_token");
    const res = await fetch(`/api/bugs/${modal.item.id}/files/${fileId}`, {
      method:"DELETE", headers: token ? {Authorization:`Bearer ${token}`} : {},
    });
    const json = await res.json();
    const files = json.data ?? json;
    setModal(m => ({...m, item: {...m.item, evidence_files: files}}));
    refetch();
  }

  async function handleDelete(id) {
    try { await bugsApi.delete(id); setConfirm(null); refetch(); }
    catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Bugs</h1>
        {!isViewer && (
          <button className="btn btn-primary" onClick={() => setModal({mode:"create"})}>+ Novo bug</button>
        )}
      </div>
      {err && <ErrorMsg msg={err} />}

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {[{key:"open",label:"Abertos",color:"var(--danger)"},
          {key:"in_progress",label:"Em andamento",color:"var(--warning)"},
          {key:"fixed",label:"Corrigidos",color:"var(--success)"},
          {key:"closed",label:"Fechados",color:"var(--text-muted)"}
        ].map(({key,label,color}) => (
          <div key={key} onClick={() => setFilterSt(f=>f===key?"":key)}
            style={{background:"var(--surface)",border:"1px solid var(--border)",
              borderRadius:8,padding:"10px 18px",cursor:"pointer",
              outline:filterSt===key?`2px solid ${color}`:undefined}}>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>{label}</div>
            <div style={{fontSize:22,fontWeight:600,color}}>{counts[key]||0}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Buscar por título, ID ou criador..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,minWidth:220,flex:1}} />
        <select value={filterSev} onChange={e=>setFilterSev(e.target.value)}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
          <option value="">Severidade</option>
          {SEV_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterMod} onChange={e=>setFilterMod(e.target.value)}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
          <option value="">Módulo</option>
          {(modules||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <span style={{fontSize:12,color:"var(--text-muted)",alignSelf:"center"}}>{filtered.length} bug(s)</span>
      </div>

      <div className="card">
        {!filtered.length ? <Empty icon="🐛" text="Nenhum bug encontrado." /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Título</th><th>TC</th><th>Módulo</th><th>Sev.</th><th>Status</th><th>Criado por</th><th>Arquivos</th><th>Tracker</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td style={{color:"var(--text-muted)",fontSize:12,fontWeight:600}}>{b.id}</td>
                    <td style={{fontWeight:500,maxWidth:220}}>{b.title}</td>
                    <td style={{fontSize:12}}>
                      {b.test_case_id ? <span style={{color:"var(--accent)",fontWeight:600}}>#{b.test_case_id}</span> : "—"}
                    </td>
                    <td>{b.module_name ? <span className="badge badge-active">{b.module_name}</span> : "—"}</td>
                    <td><Severity v={b.severity} /></td>
                    <td><BugStatus v={b.status} /></td>
                    <td style={{fontSize:12,color:"var(--text-muted)"}}>{b.created_by_name||"—"}</td>
                    <td style={{fontSize:12}}>
                      {b.evidence_files?.length > 0 ? <span style={{color:"var(--accent)"}}>📎 {b.evidence_files.length}</span> : "—"}
                    </td>
                    <td>
                      {b.tracker_url ? <a href={b.tracker_url} target="_blank" rel="noreferrer"
                          style={{color:"var(--accent)",fontSize:12,whiteSpace:"nowrap"}}>🔗 Abrir</a> : "—"}
                    </td>
                    <td>
                      {!isViewer && (
                        <div className="actions">
                          <button className="btn btn-sm" onClick={() => setModal({mode:"edit",item:b})}>✏</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setConfirm(b)}>🗑</button>
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
        <Modal title={modal.mode==="create" ? "Novo bug" : `Bug #${modal.item.id} — ${modal.item.title}`}
          onClose={() => { setModal(null); refetch(); }}>
          <BugForm initial={modal.item||{}} modules={modules||[]} testCases={testCases||[]}
            bugId={modal.item?.id} onSave={handleSave} onCancel={() => { setModal(null); refetch(); }}
            saving={saving} onFileUpload={handleFileUpload} onFileDelete={handleFileDelete} />
        </Modal>
      )}
      {confirm && (
        <ConfirmModal message={`Excluir o bug "${confirm.title}"?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
