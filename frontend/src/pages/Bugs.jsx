import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync }    from "../hooks/useAsync.js";
import { bugsApi, modulesApi, testCasesApi, cyclesApi, usersApi } from "../services/resources.js";
import { useAuth }     from "../context/AuthContext.jsx";
import { useProject }  from "../context/ProjectContext.jsx";
import { FileUpload }  from "../components/FileUpload.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select, Severity, BugStatus } from "../components/UI.jsx";

const PAGE_SIZE = 10;

const SEV_OPTS    = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const STATUS_OPTS = [{value:"open",label:"Aberto"},{value:"in_progress",label:"Em andamento"},{value:"fixed",label:"Corrigido"},{value:"closed",label:"Fechado"}];

function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"12px 0 0",fontSize:12,color:"var(--text-muted)"}}>
      <span>{total} bug(s) — Página {page} de {totalPages}</span>
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

function BugForm({ initial={}, modules, testCases, users, onSave, onCancel, saving, bugId, onFileUpload, onFileDelete }) {
  const [form, setForm] = useState({
    title:          initial.title          || "",
    description:    initial.description    || "",
    comment:        initial.comment        || "",
    tracker_url:    initial.tracker_url    || "",
    pr_url:         initial.pr_url         || "",
    severity:       initial.severity       || "medium",
    status:         initial.status         || "open",
    module_id:      initial.module_id      || "",
    test_case_id:   initial.test_case_id   || "",
    assigned_to_id: initial.assigned_to_id || "",
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
      <div className="form-row">
        <Field label="Responsável">
          <Select value={form.assigned_to_id} onChange={v=>setForm(f=>({...f,assigned_to_id:v}))}
            options={(users||[]).map(u=>({value:u.id,label:u.name}))} placeholder="Não atribuído" />
        </Field>
        <Field label="PR / Commit">
          <input value={form.pr_url} onChange={set("pr_url")} placeholder="#241 ou URL do PR" />
        </Field>
      </div>
      <Field label="Link do tracker (ClickUp, Jira, etc)">
        <input value={form.tracker_url} onChange={set("tracker_url")}
          placeholder="https://app.clickup.com/t/..." />
      </Field>
      <Field label="Comentário geral">
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

function getOpenIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("open");
}

export default function Bugs() {
  const { user }           = useAuth();
  const { currentProject } = useProject();
  const pid      = currentProject?.id;
  const isViewer = user?.role === "viewer";
  const navigate = useNavigate();

  const { data: bugs,      loading: l1, error: e1, refetch } = useAsync(() => bugsApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: modules,   loading: l2, error: e2 }          = useAsync(() => modulesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: testCases }                                   = useAsync(() => testCasesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: cycles }                                      = useAsync(() => cyclesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: users }                                       = useAsync(() => usersApi.list(), []);

  const openId    = getOpenIdFromUrl();
  const bugToOpen = openId && bugs ? bugs.find(b => String(b.id) === String(openId)) : null;

  const [editBug,        setEditBug]        = useState(null);
  const [confirm,        setConfirm]        = useState(null);
  const [search,         setSearch]         = useState("");
  const [filterSev,      setFilterSev]      = useState("");
  const [filterSt,       setFilterSt]       = useState("");
  const [filterMod,      setFilterMod]      = useState("");
  const [filterCycle,    setFilterCycle]    = useState("");
  const [saving,         setSaving]         = useState(false);
  const [err,            setErr]            = useState(null);
  const [deepLinkOpened, setDeepLinkOpened] = useState(false);
  const [page, setPage] = useState(1);

  if (l1 || l2) return <Loading />;
  if (e1 || e2) return <ErrorMsg msg={e1 || e2} />;

  // Deep link — navega para a página do bug via ?open=ID
  if (bugToOpen && !deepLinkOpened) {
    setDeepLinkOpened(true);
    navigate("/bugs/" + bugToOpen.id, { replace: true });
  }

  function copyLink(bugId) {
    const link = window.location.origin + "/qa-manager/bugs/" + bugId;
    navigator.clipboard.writeText(link).then(() => alert("Link copiado!\n" + link));
  }

  const selectedCycle = filterCycle && cycles
    ? (cycles.find(c => String(c.id) === filterCycle) || null)
    : null;

  const filtered = (bugs || []).filter(b => {
    if (filterSev && b.severity !== filterSev)          return false;
    if (filterSt  && b.status   !== filterSt)           return false;
    if (filterMod && String(b.module_id) !== filterMod) return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) &&
        !(b.created_by_name||"").toLowerCase().includes(search.toLowerCase()) &&
        !String(b.id).includes(search)) return false;
    if (selectedCycle && selectedCycle.start_date && selectedCycle.end_date) {
      const bugDate  = new Date(b.created_at);
      const cycStart = new Date(selectedCycle.start_date);
      const cycEnd   = new Date(selectedCycle.end_date + "T23:59:59");
      if (bugDate < cycStart || bugDate > cycEnd) return false;
    }
    return true;
  });

  const counts      = (bugs || []).reduce((a, b) => ({...a, [b.status]:(a[b.status]||0)+1}), {});
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paged       = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const cycleOptions = (cycles || []).map(c => ({
    value: String(c.id),
    label: c.version ? `${c.name} (v${c.version})` : c.name,
  }));
  const hasFilters = filterSev || filterSt || filterMod || filterCycle || search;

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      let saved;
      if (!editBug.id) {
        saved = await bugsApi.create({...form, project_id:pid, created_by_id:user?.id});
        // Após criar navega direto para a página do bug
        setEditBug(null);
        refetch();
        navigate("/bugs/" + saved.id);
      } else {
        saved = await bugsApi.update(editBug.id, form);
        setEditBug(null);
        refetch();
        navigate("/bugs/" + saved.id);
      }
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(file) {
    const fd = new FormData(); fd.append("file", file);
    const token = localStorage.getItem("qa_token");
    const res = await fetch(`/api/bugs/${editBug.id}/files`, {
      method:"POST", body:fd, headers: token ? {Authorization:`Bearer ${token}`} : {},
    });
    const json = await res.json();
    const files = json.data ?? json;
    setEditBug(b => ({...b, evidence_files: files}));
    refetch();
  }

  async function handleFileDelete(fileId) {
    const token = localStorage.getItem("qa_token");
    const res = await fetch(`/api/bugs/${editBug.id}/files/${fileId}`, {
      method:"DELETE", headers: token ? {Authorization:`Bearer ${token}`} : {},
    });
    const json = await res.json();
    const files = json.data ?? json;
    setEditBug(b => ({...b, evidence_files: files}));
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
          <button className="btn btn-primary" onClick={() => setEditBug({})}>+ Novo bug</button>
        )}
      </div>
      {err && <ErrorMsg msg={err} />}

      {/* Cards de status */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {[{key:"open",      label:"Abertos",      color:"var(--danger)"},
          {key:"in_progress",label:"Em andamento", color:"var(--warning)"},
          {key:"fixed",     label:"Corrigidos",    color:"var(--success)"},
          {key:"closed",    label:"Fechados",      color:"var(--text-muted)"}
        ].map(({key,label,color}) => (
          <div key={key} onClick={() => setFilterSt(f => f===key ? "" : key)}
            style={{background:"var(--surface)",border:"1px solid var(--border)",
              borderRadius:8,padding:"10px 18px",cursor:"pointer",
              outline:filterSt===key ? `2px solid ${color}` : undefined}}>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>{label}</div>
            <div style={{fontSize:22,fontWeight:600,color}}>{counts[key]||0}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:10,marginBottom:8,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Buscar por título, ID ou criador..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,minWidth:220,flex:1}} />
        <select value={filterCycle} onChange={e=>{ setFilterCycle(e.target.value); setPage(1); }}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,minWidth:160}}>
          <option value="">🔁 Todos os ciclos</option>
          {cycleOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterSev} onChange={e=>{ setFilterSev(e.target.value); setPage(1); }}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
          <option value="">Severidade</option>
          {SEV_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterMod} onChange={e=>{ setFilterMod(e.target.value); setPage(1); }}
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
          <option value="">Módulo</option>
          {(modules||[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterSev(""); setFilterSt(""); setFilterMod(""); setFilterCycle(""); }}
            style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--danger)",
              color:"var(--danger)",background:"none",fontSize:13,cursor:"pointer"}}>
            ✕ Limpar
          </button>
        )}
        <span style={{fontSize:12,color:"var(--text-muted)",alignSelf:"center"}}>{filtered.length} bug(s)</span>
      </div>

      {selectedCycle && (
        <div style={{background:"var(--accent-bg)",border:"1px solid var(--accent)",
          borderRadius:8,padding:"6px 14px",marginBottom:12,fontSize:12,color:"var(--accent)"}}>
          🔁 Ciclo: <strong>{selectedCycle.name}</strong>
          {selectedCycle.version && <span> — v{selectedCycle.version}</span>}
          {selectedCycle.start_date && (
            <span> | {new Date(selectedCycle.start_date).toLocaleDateString("pt-BR")} → {selectedCycle.end_date ? new Date(selectedCycle.end_date).toLocaleDateString("pt-BR") : "hoje"}</span>
          )}
        </div>
      )}

      <div className="card">
        {!filtered.length ? <Empty icon="🐛" text="Nenhum bug encontrado." /> : (
          <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Título</th><th>TC</th><th>Módulo</th>
                  <th>Sev.</th><th>Status</th><th>Responsável</th><th>Data</th><th>Tracker</th><th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map(b => (
                  <tr key={b.id}>
                    <td style={{color:"var(--text-muted)",fontSize:12,fontWeight:600}}>{b.id}</td>
                    <td style={{fontWeight:500,maxWidth:220}}>
                      <button onClick={() => navigate("/bugs/" + b.id)}
                        style={{background:"none",border:"none",cursor:"pointer",
                          color:"var(--accent)",textAlign:"left",fontSize:13,padding:0,fontWeight:500}}>
                        {b.title}
                      </button>
                    </td>
                    <td style={{fontSize:12}}>
                      {b.test_case_id ? <span style={{color:"var(--accent)",fontWeight:600}}>#{b.test_case_id}</span> : "—"}
                    </td>
                    <td>{b.module_name ? <span className="badge badge-active">{b.module_name}</span> : "—"}</td>
                    <td><Severity v={b.severity} /></td>
                    <td><BugStatus v={b.status} /></td>
                    <td style={{fontSize:12,color:"var(--text-muted)"}}>
                      {b.assigned_to_name || b.created_by_name || "—"}
                    </td>
                    <td style={{fontSize:11,color:"var(--text-muted)",whiteSpace:"nowrap"}}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td>
                      {b.tracker_url
                        ? <a href={b.tracker_url} target="_blank" rel="noreferrer"
                            style={{color:"var(--accent)",fontSize:12,whiteSpace:"nowrap"}}>🔗 Abrir</a>
                        : "—"}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-sm" title="Copiar link"
                          onClick={() => copyLink(b.id)} style={{fontSize:11}}>🔗</button>
                        {!isViewer && (
                          <>
                            <button className="btn btn-sm" onClick={() => navigate("/bugs/" + b.id)}>▶</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setConfirm(b)}>🗑</button>
                          </>
                        )}
                      </div>
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

      {/* Modal de criação */}
      {editBug && (
        <Modal
          title={editBug.id ? `Editar Bug #${editBug.id}` : "Novo bug"}
          onClose={() => setEditBug(null)}>
          <BugForm
            initial={editBug}
            modules={modules||[]}
            testCases={testCases||[]}
            users={users||[]}
            bugId={editBug.id}
            onSave={handleSave}
            onCancel={() => setEditBug(null)}
            saving={saving}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
          />
        </Modal>
      )}

      {confirm && (
        <ConfirmModal message={`Excluir o bug "${confirm.title}"?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

