import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAsync }    from "../hooks/useAsync.js";
import { bugsApi, modulesApi, testCasesApi, cyclesApi, usersApi } from "../services/resources.js";
import { useAuth }     from "../context/AuthContext.jsx";
import { useProject }  from "../context/ProjectContext.jsx";
import { FileUpload }  from "../components/FileUpload.jsx";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select, Severity, BugStatus } from "../components/UI.jsx";

function detectOS() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Win/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "";
}
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua)) return "Safari";
  return "";
}

const TEST_TYPES_BUG = [
  "Funcional","Regressão","Integração","Performance","Segurança",
  "Usabilidade","Smoke","Sanidade","Exploratório","Aceitação","API","Automação"
];

function StepsSectionBug({ steps, onChange }) {
  // Sem useState — usa steps diretamente para evitar hook em componente condicional
  const list = steps ? steps.split("\n") : [];
  function updateStep(i, val) {
    const n=[...list]; n[i]=val; onChange(n.join("\n"));
  }
  function addStep() {
    const n=[...list,""]; onChange(n.join("\n") + (list.length===0?"\n":""));
    setTimeout(()=>{ const inp=document.querySelectorAll(".step-input-bug"); if(inp[inp.length-1])inp[inp.length-1].focus(); },50);
  }
  function removeStep(i) {
    onChange(list.filter((_,idx)=>idx!==i).join("\n"));
  }
  return (
    <div>
      {list.filter(Boolean).length===0 && <p style={{fontSize:13,color:"var(--text-muted)",fontStyle:"italic",marginBottom:8}}>Nenhum passo adicionado.</p>}
      {list.map((step,i)=>(
        <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
          <div style={{minWidth:24,height:24,borderRadius:"50%",background:"var(--accent-bg)",color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:500,flexShrink:0,marginTop:6}}>{i+1}</div>
          <input className="step-input-bug" value={step} onChange={e=>updateStep(i,e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addStep();}if(e.key==="Backspace"&&step===""){e.preventDefault();removeStep(i);}}}
            placeholder={"Passo "+(i+1)+"..."}
            style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,background:"var(--bg)",color:"var(--text)"}} />
          <button onClick={()=>removeStep(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:"4px",fontSize:13,marginTop:4}}>✕</button>
        </div>
      ))}
      <button onClick={addStep} style={{width:"100%",padding:"7px",marginTop:4,border:"1px dashed var(--border)",borderRadius:6,background:"transparent",cursor:"pointer",fontSize:12,color:"var(--text-muted)",fontFamily:"inherit"}}>+ Adicionar passo</button>
    </div>
  );
}

const PAGE_SIZE = 10;

const SEV_OPTS    = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const PRIO_OPTS   = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const ENV_OPTS    = [{value:"production",label:"Produção"},{value:"homologation",label:"Homologação"},{value:"development",label:"Desenvolvimento"}];
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
    steps:          initial.steps          || "",
    tracker_url:    initial.tracker_url    || "",
    evidence_url:   initial.evidence_url   || "",
    pr_url:         initial.pr_url         || "",
    severity:       initial.severity       || "medium",
    priority:       initial.priority       || "medium",
    status:         initial.status         || "open",
    module_id:      initial.module_id      || "",
    test_case_id:   initial.test_case_id   || "",
    assigned_to_id: initial.assigned_to_id || "",
    environment:    initial.environment    || "production",
    os:             initial.os             || detectOS(),
    browser:        initial.browser        || detectBrowser(),
    impact:         initial.impact         || "",
    actual_result:  initial.actual_result  || "",
    expected_result: initial.expected_result || "",
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
        <Field label="Prioridade">
          <Select value={form.priority} onChange={v=>setForm(f=>({...f,priority:v}))} options={PRIO_OPTS} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Status">
          <Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={STATUS_OPTS} />
        </Field>
        <Field label="Ambiente">
          <Select value={form.environment} onChange={v=>setForm(f=>({...f,environment:v}))} options={ENV_OPTS} />
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
      <Field label="Link de evidência (Drive, Loom, Jam, etc)">
        <input value={form.evidence_url||""} onChange={set("evidence_url")}
          placeholder="https://drive.google.com/..." />
      </Field>
      <Field label="Descrição">
        <textarea value={form.description} onChange={set("description")} placeholder="Detalhes adicionais..." />
      </Field>
      <Field label="Passos para reproduzir">
        <StepsSectionBug steps={form.steps} onChange={v => setForm(f=>({...f, steps:v}))} />
      </Field>
      <Field label="Resultado obtido">
        <textarea value={form.actual_result} onChange={set("actual_result")}
          placeholder="O que aconteceu de fato? Ex: Sistema retornou erro 500." />
      </Field>
      <Field label="Resultado esperado">
        <textarea value={form.expected_result} onChange={set("expected_result")}
          placeholder="O que deveria acontecer? Ex: Sistema exibe mensagem de sucesso." />
      </Field>
      {bugId ? (
        <Field label="Arquivos / Evidências">
          <FileUpload files={initial.evidence_files || []} onUpload={onFileUpload} onDelete={onFileDelete} />
        </Field>
      ) : null}
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
  const isViewer  = user?.role === "viewer";
  const canManage = user?.role === "admin" || user?.role === "manager";
  const navigate = useNavigate();
  const location = useLocation();

  const { data: bugs,      loading: l1, error: e1, refetch } = useAsync(() => bugsApi.list(pid ? {project_id:pid} : {}), [pid, location.state?.refresh]);
  const { data: modules,   loading: l2, error: e2 }          = useAsync(() => modulesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: testCases }                                   = useAsync(() => testCasesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: cycles }                                      = useAsync(() => cyclesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: users }                                       = useAsync(() => usersApi.mentions(), []);

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
  const [activeTab,      setActiveTab]      = useState("ativos");
  const [showArchived,   setShowArchived]   = useState(false);

  // Busca IDs de bugs do ciclo selecionado via useEffect (deve ficar ANTES dos early returns)
  const [cycleBugIdsSet, setCycleBugIdsSet] = useState(null);
  useEffect(() => {
    if (!filterCycle || filterCycle === "none" || filterCycle === "") {
      setCycleBugIdsSet(null);
      return;
    }
    cyclesApi.getBugs(filterCycle).then(ids => {
      setCycleBugIdsSet(ids ? new Set(ids.map(Number)) : new Set());
    }).catch(() => setCycleBugIdsSet(new Set()));
  }, [filterCycle]);

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

  const selectedCycle = filterCycle && cycles && filterCycle !== "none"
    ? (cycles.find(c => String(c.id) === filterCycle) || null)
    : null;

  const filtered = (bugs || []).filter(b => {
    // Filtro por aba
    if (activeTab === "ativos"      && !["open","in_progress"].includes(b.status)) return false;
    if (activeTab === "finalizados" && !["fixed","closed"].includes(b.status))     return false;
    // Oculta bugs arquivados na aba Finalizados (toggle)
    if (activeTab === "finalizados" && !showArchived && (b.cycle_status === "archived" || b.closed_by_archive)) return false;
    if (filterSev && b.severity !== filterSev)          return false;
    if (filterSt  && b.status   !== filterSt)           return false;
    if (filterMod && String(b.module_id) !== filterMod) return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) &&
        !(b.created_by_name||"").toLowerCase().includes(search.toLowerCase()) &&
        !String(b.id).includes(search)) return false;
    if (filterCycle && filterCycle !== "none") {
      if (!cycleBugIdsSet) return true;
      return cycleBugIdsSet.has(Number(b.id));
    }
    if (filterCycle === "none") {
      if (b.test_case_id) return false;
      return true;
    }
    return true;
  });

  const counts           = (bugs || []).reduce((a, b) => ({...a, [b.status]:(a[b.status]||0)+1}), {});
  const countAtivos      = (bugs || []).filter(b => ["open","in_progress"].includes(b.status)).length;
  const countFinalizados = (bugs || []).filter(b =>
    ["fixed","closed"].includes(b.status) && !b.closed_by_archive
  ).length;
  const countArquivados = (bugs || []).filter(b =>
    ["fixed","closed"].includes(b.status) && b.closed_by_archive
  ).length;
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paged       = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const activeCycles   = (cycles || []).filter(c => c.status === "active");
  const closedCycles   = (cycles || [])
    .filter(c => c.status !== "active")
    .sort((a, b) => new Date(b.start_date||0) - new Date(a.start_date||0))
    .slice(0, 5);
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

      {/* Abas Ativos / Finalizados */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"2px solid var(--border)"}}>
        {[
          {key:"ativos",      label:"Ativos",      count:countAtivos},
          {key:"finalizados", label:"Finalizados",  count:showArchived ? countFinalizados + countArquivados : countFinalizados},
        ].map(({key,label,count}) => (
          <button key={key} onClick={()=>{ setActiveTab(key); setFilterSt(""); setSearch(""); setPage(1); setShowArchived(false); }}
            style={{padding:"8px 20px",border:"none",background:"none",cursor:"pointer",
              fontSize:14,fontWeight:activeTab===key?600:400,
              color:activeTab===key?"var(--accent)":"var(--text-muted)",
              borderBottom:activeTab===key?"2px solid var(--accent)":"2px solid transparent",
              marginBottom:-2}}>
            {label} <span style={{fontSize:12,background:"var(--accent-bg)",color:"var(--accent)",
              borderRadius:10,padding:"1px 7px",marginLeft:4}}>{count}</span>
          </button>
        ))}
      </div>

      {/* Toggle mostrar arquivados — só aparece na aba Finalizados */}
      {activeTab === "finalizados" && (
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <label style={{fontSize:13,color:"var(--text-muted)",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <input type="checkbox" checked={showArchived} onChange={e=>{ setShowArchived(e.target.checked); setPage(1); }}
              style={{cursor:"pointer"}} />
            Mostrar bugs de ciclos arquivados
          </label>
          {showArchived && (
            <span style={{fontSize:11,background:"var(--accent-bg)",color:"var(--accent)",
              borderRadius:10,padding:"2px 8px"}}>
              Incluindo arquivados
            </span>
          )}
        </div>
      )}

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
          <option value="none">🔍 Sem vínculo com ciclo</option>
          {activeCycles.length > 0 && <optgroup label="── Ativos ──">
            {activeCycles.map(c=><option key={c.id} value={String(c.id)}>{c.name}{c.version?` (v${c.version})`:""}</option>)}
          </optgroup>}
          {closedCycles.length > 0 && <optgroup label="── Encerrados (últimos 5) ──">
            {closedCycles.map(c=><option key={c.id} value={String(c.id)}>{c.name}{c.version?` (v${c.version})`:""}</option>)}
          </optgroup>}
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
                    <td>
                      <BugStatus v={b.status} />
                      {b.closed_by_archive && (
                        <span title="Fechado automaticamente ao arquivar ciclo"
                          style={{marginLeft:4,fontSize:12}}>🔒</span>
                      )}
                    </td>
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
                          <button className="btn btn-sm" onClick={() => navigate("/bugs/" + b.id)}>▶</button>
                        )}
                        {canManage && (
                          <button className="btn btn-sm btn-danger" onClick={() => setConfirm(b)}>🗑</button>
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

