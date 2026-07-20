import { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../hooks/useAsync.js";
import { cyclesApi, testCasesApi, bugsApi, usersApi, testPlansApi } from "../services/resources.js";
import { useAuth }    from "../context/AuthContext.js";
import { useProject } from "../context/ProjectContext.js";
import { FileUpload } from "../components/FileUpload.js";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select, ExecBadge, CycleBadge } from "../components/UI.js";
import type { Cycle, Execution, TestCase, Bug, MentionUser } from "../types/index.js";

interface CycleFormData {
  name: string;
  description: string;
  status: string;
  version: string;
  start_date: string;
  end_date: string;
  assigned_to_id: string;
  test_types: string[];
}

interface ExecutionUpdate {
  status: string;
  notes: string;
  bug_id: string;
}

interface CycleWithStats extends Cycle {
  total_executions?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  not_executed?: number;
  version?: string;
  test_types?: string;
}

type CycleModalState = { mode: "create"; item?: null } | { mode: "edit"; item: CycleWithStats };

const CYCLE_STATUS = [{value:"active",label:"Ativo"},{value:"completed",label:"Concluído"},{value:"archived",label:"Arquivado"}];
const EXEC_STATUS  = [{value:"not_executed",label:"Não executado"},{value:"passed",label:"Passou"},{value:"failed",label:"Falhou"},{value:"blocked",label:"Bloqueado"}];
const TEST_TYPES   = ["Funcional","Regressão","Integração","Performance","Segurança","Usabilidade","Smoke","Sanidade","Exploratório","Aceitação","API","Automação"];
const PAGE_SIZE    = 10;

function Pagination({ page, totalPages, total, onChange, label="item(s)" }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"12px 0 0",fontSize:12,color:"var(--text-muted)"}}>
      <span>{total} {label} — Página {page} de {totalPages}</span>
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

function CycleForm({ initial={}, onSave, onCancel, saving }) {
  const initTypes = initial.test_types ? initial.test_types.split(",").filter(Boolean) : [];
  const [form, setForm] = useState({
    name:        initial.name        || "",
    description: initial.description || "",
    version:     initial.version     || "",
    test_types:  initTypes,
    start_date:  initial.start_date  || "",
    end_date:    initial.end_date    || "",
    status:      initial.status      || "active",
  });
  const set = k => e => setForm(f => ({...f,[k]:e.target.value}));
  const toggle = t => setForm(f => ({...f, test_types: f.test_types.includes(t)?f.test_types.filter(x=>x!==t):[...f.test_types,t]}));
  return (
    <>
      <Field label="Nome *"><input value={form.name} onChange={set("name")} placeholder="Ex: Sprint 1" autoFocus /></Field>
      <div className="form-row">
        <Field label="Versão"><input value={form.version} onChange={set("version")} placeholder="Ex: 1.2.0" /></Field>
        <Field label="Status"><Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={CYCLE_STATUS} /></Field>
      </div>
      <div className="form-row">
        <Field label="Data início"><input type="date" value={form.start_date} onChange={set("start_date")} /></Field>
        <Field label="Data fim"><input type="date" value={form.end_date} onChange={set("end_date")} /></Field>
      </div>
      <Field label="Tipos de teste">
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
          {TEST_TYPES.map(t => (
            <button key={t} type="button" onClick={() => toggle(t)}
              style={{padding:"4px 10px",borderRadius:20,fontSize:12,cursor:"pointer",
                border:"1px solid var(--border)",
                background:form.test_types.includes(t)?"var(--accent)":"var(--surface)",
                color:form.test_types.includes(t)?"#fff":"var(--text-muted)"}}>
              {t}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Descrição"><textarea value={form.description} onChange={set("description")} placeholder="Objetivo deste ciclo..." /></Field>
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving||!form.name.trim()}>
          {saving?"Salvando…":"Salvar"}
        </button>
      </div>
    </>
  );
}

function AddCasesModal({ cycleId, existingIds, projectId, onClose, onAdded }) {
  const { data: allCases, loading } = useAsync(() => testCasesApi.list(projectId?{project_id:projectId}:{}), [projectId]);
  const [selected, setSelected] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState("");
  const [filterMod,setFilterMod]= useState("");

  const available = (allCases||[]).filter(c => {
    if (existingIds.includes(c.id)) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !String(c.id).includes(search)) return false;
    if (filterMod && String(c.module_id) !== filterMod) return false;
    return true;
  });
  const modules = [...new Map((allCases||[]).map(c=>[c.module_id,{id:c.module_id,name:c.module_name}])).values()];
  const allSelected = available.length > 0 && selected.length === available.length;

  async function handleAdd() {
    if (!selected.length) return;
    setSaving(true);
    try { await cyclesApi.addExecutions(cycleId, selected); onAdded(); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Adicionar casos de teste ao ciclo" onClose={onClose}>
      {loading ? <Loading /> : (
        <>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Buscar por título ou ID..."
              style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}} />
            <select value={filterMod} onChange={e=>setFilterMod(e.target.value)}
              style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
              <option value="">Todos os módulos</option>
              {modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {!available.length ? <Empty text="Todos os casos já estão no ciclo ou nenhum encontrado." /> : (
            <>
              <label style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                fontSize:12,color:"var(--text-muted)",borderBottom:"1px solid var(--border)",cursor:"pointer",
                background:"var(--bg)",borderRadius:"6px 6px 0 0"}}>
                <input type="checkbox" checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : available.map(c=>c.id))} />
                <strong>Selecionar todos ({available.length})</strong>
                {selected.length>0 && <span style={{marginLeft:"auto",color:"var(--accent)"}}>{selected.length} selecionado(s)</span>}
              </label>
              <div style={{maxHeight:320,overflowY:"auto",border:"1px solid var(--border)",borderTop:"none",borderRadius:"0 0 6px 6px"}}>
                {available.map(c => (
                  <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,
                    padding:"9px 12px",cursor:"pointer",borderBottom:"1px solid var(--border-soft)",
                    background:selected.includes(c.id)?"var(--accent-bg)":undefined}}>
                    <input type="checkbox" checked={selected.includes(c.id)}
                      onChange={() => setSelected(s=>s.includes(c.id)?s.filter(x=>x!==c.id):[...s,c.id])} />
                    <span style={{fontSize:12,color:"var(--accent)",fontWeight:600,minWidth:28}}>#{c.id}</span>
                    <span style={{flex:1,fontSize:13}}>{c.title}</span>
                    <span className="badge badge-active" style={{fontSize:10}}>{c.module_name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="modal-footer">
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving||!selected.length}>
              {saving?"Adicionando…":`Adicionar (${selected.length})`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ExecutionModal({ cycleId, execution, onClose, onSaved }) {
  const { user: currentUser } = useAuth();
  const { data: bugs  } = useAsync(() => bugsApi.list());
  const { data: users } = useAsync(() => usersApi.mentions());
  const [form, setForm] = useState({
    status:         execution.status         || "not_executed",
    evidence_url:   execution.evidence_url   || "",
    comment:        execution.comment        || "",
    notes:          execution.notes          || "",
    bug_id:         execution.bug_id         || "",
    assigned_to_id: execution.assigned_to_id || "",
  });
  const [files,     setFiles]     = useState(execution.evidence_files || []);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const set = k => e => setForm(f => ({...f,[k]:e.target.value}));

  async function handleFileUpload(file) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const token = localStorage.getItem("qa_token");
      const res = await fetch(`/api/cycles/${cycleId}/executions/${execution.id}/evidence`, {
        method:"POST", body:fd, headers:token?{Authorization:`Bearer ${token}`}:{},
      });
      const json = await res.json();
      setFiles(json.data ?? json);
    } finally { setUploading(false); }
  }

  async function handleFileDelete(fileId) {
    const token = localStorage.getItem("qa_token");
    const res = await fetch(`/api/cycles/${cycleId}/executions/${execution.id}/evidence/${fileId}`,
      { method:"DELETE", headers:token?{Authorization:`Bearer ${token}`}:{} });
    const json = await res.json();
    setFiles(json.data ?? json);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await cyclesApi.updateExecution(cycleId, execution.id, {
        ...form, bug_id:form.bug_id||null, executed_by_id:currentUser?.id,
        assigned_to_id:form.assigned_to_id||null,
      });
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`▶ #${execution.test_case_id} — ${execution.test_case_title}`} onClose={onClose}>
      <div style={{background:"var(--bg)",borderRadius:6,padding:"8px 12px",marginBottom:14,fontSize:12,color:"var(--text-muted)"}}>
        <strong>Módulo:</strong> {execution.module_name} &nbsp;|&nbsp; <strong>Prioridade:</strong> {execution.priority}
      </div>
      <Field label="Status *">
        <Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={EXEC_STATUS} />
      </Field>
      <div className="form-row">
        <Field label="Executado por"><input value={currentUser?.name||""} disabled style={{background:"var(--bg)"}} /></Field>
        <Field label="Responsável pelo teste">
          <Select value={form.assigned_to_id} onChange={v=>setForm(f=>({...f,assigned_to_id:v}))}
            options={(users||[]).map(u=>({value:u.id,label:u.name}))} placeholder="Não atribuído" />
        </Field>
      </div>
      <Field label="Comentário">
        <textarea value={form.comment} onChange={set("comment")} rows={3} placeholder="O que foi observado durante a execução..." />
      </Field>
      <Field label="URL de evidência">
        <input value={form.evidence_url} onChange={set("evidence_url")} placeholder="https://..." />
      </Field>
      <Field label="Arquivos de evidência">
        <FileUpload files={files} onUpload={handleFileUpload} onDelete={handleFileDelete} />
      </Field>
      <Field label="Vincular bug">
        <Select value={form.bug_id} onChange={v=>setForm(f=>({...f,bug_id:v}))}
          options={(bugs||[]).map(b=>({value:b.id,label:`#${b.id} ${b.title}`}))} placeholder="Nenhum bug vinculado" />
      </Field>
      <Field label="Observações"><textarea value={form.notes} onChange={set("notes")} placeholder="Notas adicionais..." /></Field>
      <div className="modal-footer">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving?"Salvando…":"Salvar execução"}
        </button>
      </div>
    </Modal>
  );
}

function TCDetailModal({ execution, onClose }) {
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:580}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:4}}>
              #{execution.test_case_id} — {execution.module_name}
            </div>
            <h3 style={{margin:0}}>{execution.test_case_title}</h3>
          </div>
          <ExecBadge v={execution.status} />
        </div>
        {execution.assigned_to_name && (
          <div style={{background:"var(--accent-bg)",borderRadius:6,padding:"6px 12px",fontSize:12,color:"var(--accent)",marginBottom:12}}>
            👤 Responsável: <strong>{execution.assigned_to_name}</strong>
          </div>
        )}
        {[{l:"Pré-condições",v:execution.preconditions},{l:"Passos",v:execution.steps},{l:"Resultado esperado",v:execution.expected_result}]
          .map(({l,v})=>v?(
            <div key={l} style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{l}</div>
              <div style={{fontSize:13,whiteSpace:"pre-line",background:"var(--bg)",padding:"8px 12px",borderRadius:6}}>{v}</div>
            </div>
          ):null)}
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function ActivityTimeline({ activity }) {
  if (!activity?.length) return (
    <div style={{color:"var(--text-muted)",fontSize:13,padding:"24px 0",textAlign:"center"}}>
      Nenhuma atividade registrada.
    </div>
  );
  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };
  const dotColors = {
    "criou o ciclo":     "#9CA3AF",
    "alterou o status":  "#16A34A",
    "editou o nome":     "#D97706",
    "alterou a versão":  "#2563EB",
    "arquivou o ciclo":  "#6B7280",
  };
  const icons = {
    "criou o ciclo":     "📋",
    "alterou o status":  "🔄",
    "editou o nome":     "✏️",
    "alterou a versão":  "🏷️",
    "arquivou o ciclo":  "📦",
  };
  const translateDetail = d => d ? d
    .replace(/open/g,"Aberto")
    .replace(/in_progress/g,"Em andamento")
    .replace(/fixed/g,"Corrigido")
    .replace(/closed/g,"Fechado")
    .replace(/active/g,"Ativo")
    .replace(/completed/g,"Concluído")
    .replace(/archived/g,"Arquivado") : null;

  return (
    <div style={{position:"relative",paddingLeft:28,padding:"8px 0 8px 28px"}}>
      {/* Linha vertical */}
      <div style={{position:"absolute",left:9,top:6,bottom:6,width:2,
        background:"var(--border)",borderRadius:2}} />
      {activity.map((a,i) => {
        const color = dotColors[a.action] || "#9CA3AF";
        const icon  = icons[a.action] || "📋";
        return (
          <div key={a.id||i} style={{position:"relative",marginBottom:i<activity.length-1?16:0}}>
            {/* Bolinha */}
            <div style={{position:"absolute",left:-28,top:2,width:20,height:20,
              borderRadius:"50%",background:color+"20",border:"1.5px solid "+color+"60",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
              {icon}
            </div>
            {/* Card */}
            <div style={{background:"var(--card)",border:"1px solid var(--border)",
              borderRadius:8,padding:"10px 14px",marginLeft:4}}>
              <div style={{fontSize:13,lineHeight:1.5,display:"flex",flexWrap:"wrap",
                alignItems:"center",gap:4}}>
                <span style={{fontWeight:600}}>{a.user_name||"Sistema"}</span>
                <span style={{color:"var(--text-muted)"}}>{a.action}</span>
                {translateDetail(a.detail) && (
                  <span style={{fontSize:11,color:color,background:color+"15",
                    padding:"2px 8px",borderRadius:10,fontWeight:500}}>
                    {translateDetail(a.detail)}
                  </span>
                )}
              </div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>
                🕐 {fmtDate(a.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CycleDetail({ cycle, onBack, onRefresh }) {
  const { user }    = useAuth();
  const isViewer    = user?.role === "viewer";
  const canManage   = user?.role === "admin" || user?.role === "manager";
  const navigate    = useNavigate();
  const { data: execs, loading, error, refetch } = useAsync(()=>cyclesApi.listExecutions(cycle.id), [cycle.id]);
  const { data: activity } = useAsync(()=>cyclesApi.getActivity(cycle.id), [cycle.id]);
  // Bugs arquivados vinculados às execuções deste ciclo
  const archivedBugs = (execs||[])
    .filter(e => e.bug_id)
    .reduce((acc, e) => {
      if (!acc.find(x => x.bug_id === e.bug_id)) acc.push(e);
      return acc;
    }, []);
  const [addModal,  setAddModal]  = useState(false);
  const [execModal, setExecModal] = useState<Execution | null>(null);
  const [tcModal,   setTcModal]   = useState<TestCase | null>(null);
  const [confirm,   setConfirm]   = useState<Execution | Bug | null>(null);
  const [filter,    setFilter]    = useState("");
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [activeTab, setActiveTab] = useState("execucoes");
  const { currentProject } = useProject();

  const existingIds = (execs||[]).map(e=>e.test_case_id);
  const filtered    = (execs||[]).filter(e => {
    if (filter && e.status !== filter) return false;
    if (search && !e.test_case_title.toLowerCase().includes(search.toLowerCase()) &&
        !e.module_name.toLowerCase().includes(search.toLowerCase()) &&
        !String(e.test_case_id).includes(search)) return false;
    return true;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const stats = (execs||[]).reduce((a,e)=>({...a,[e.status]:(a[e.status]||0)+1}),{});
  const types = cycle.test_types ? cycle.test_types.split(",").filter(Boolean) : [];

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <button className="btn" onClick={onBack}>← Voltar</button>
          <div>
            <h1>{cycle.name}</h1>
            <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2,display:"flex",gap:12,flexWrap:"wrap"}}>
              {cycle.version    && <span>📦 v{cycle.version}</span>}
              {cycle.start_date && <span>📅 {new Date(cycle.start_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
              {cycle.end_date   && <span>🏁 {new Date(cycle.end_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
              {types.length>0   && <span>🧪 {types.join(" · ")}</span>}
            </div>
          </div>
          <CycleBadge v={cycle.status} />
        </div>
        {!isViewer && (
          <button className="btn btn-primary" onClick={()=>setAddModal(true)}>+ Adicionar testes</button>
        )}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {[{key:"passed",label:"Passou",color:"var(--success)"},
          {key:"failed",label:"Falhou",color:"var(--danger)"},
          {key:"blocked",label:"Bloqueado",color:"var(--purple)"},
          {key:"not_executed",label:"Não executado",color:"var(--text-muted)"}
        ].map(({key,label,color})=>(
          <div key={key} onClick={()=>{ setFilter(f=>f===key?"":key); setPage(1); }}
            style={{background:"var(--surface)",border:"1px solid var(--border)",
              borderRadius:8,padding:"10px 16px",cursor:"pointer",
              outline:filter===key?`2px solid ${color}`:undefined}}>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>{label}</div>
            <div style={{fontSize:20,fontWeight:600,color}}>{stats[key]||0}</div>
          </div>
        ))}
      </div>

      {/* Abas: Execuções | Histórico */}
      <div style={{display:"flex",gap:8,marginBottom:16,borderBottom:"1px solid var(--border)",paddingBottom:0}}>
        {[["execucoes","▶ Execuções"],["historico","📋 Histórico"]].map(([key,label])=>(
          <button key={key} onClick={()=>setActiveTab(key)}
            style={{padding:"8px 16px",background:"none",border:"none",cursor:"pointer",
              fontSize:13,fontWeight:activeTab===key?600:400,
              color:activeTab===key?"var(--accent)":"var(--text-muted)",
              borderBottom:activeTab===key?"2px solid var(--accent)":"2px solid transparent",
              marginBottom:-1}}>
            {label}
            {key==="historico" && activity?.length > 0 && (
              <span style={{marginLeft:6,background:"var(--border)",borderRadius:10,
                padding:"1px 6px",fontSize:10,color:"var(--text-muted)"}}>
                {activity.length}
              </span>
            )}

          </button>
        ))}
      </div>

      {activeTab === "execucoes" && (
      <div style={{marginBottom:16}}>
        <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Buscar por título, módulo ou ID..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,width:"100%",maxWidth:380}} />
      </div>
      )}

      {activeTab === "historico" && (
        <div className="card" style={{padding:"16px 20px"}}>
          <ActivityTimeline activity={activity||[]} />
        </div>
      )}


      {activeTab === "execucoes" && (
      <div className="card">
        {!filtered.length ? <Empty icon="🔁" text="Nenhuma execução encontrada." /> : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ID</th><th>Caso de teste</th><th>Módulo</th><th>Status</th><th>Executado por</th><th>Responsável</th><th>Comentário</th><th>Evidências</th><th></th></tr>
                </thead>
                <tbody>
                  {paged.map(e=>(
                    <tr key={e.id}>
                      <td>
                        <button onClick={()=>setTcModal(e)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"var(--accent)",fontWeight:700,fontSize:12,padding:0}}>
                          #{e.test_case_id}
                        </button>
                      </td>
                      <td style={{fontWeight:500,maxWidth:200}}>
                        <button onClick={()=>setTcModal(e)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"var(--text)",textAlign:"left",fontSize:13,padding:0}}>
                          {e.test_case_title}
                        </button>
                      </td>
                      <td><span className="badge badge-active">{e.module_name}</span></td>
                      <td><ExecBadge v={e.status} /></td>
                      <td style={{fontSize:12,color:"var(--text-muted)"}}>{e.executed_by_name||"—"}</td>
                      <td style={{fontSize:12,color:"var(--text-muted)"}}>{e.assigned_to_name||"—"}</td>
                      <td style={{fontSize:12,color:"var(--text-muted)",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {e.comment||"—"}
                      </td>
                      <td style={{fontSize:12}}>
                        {e.evidence_files?.length>0 && <span style={{color:"var(--accent)"}}>📎{e.evidence_files.length}</span>}
                        {e.evidence_url && <a href={e.evidence_url} target="_blank" rel="noreferrer" style={{color:"var(--accent)",marginLeft:4}}>🔗</a>}
                        {!e.evidence_files?.length && !e.evidence_url && "—"}
                      </td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-sm" onClick={()=>setExecModal(e)}>▶</button>
                          {canManage && (
                            <button className="btn btn-sm btn-danger" onClick={()=>setConfirm(e)}>🗑</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} label="execução(ões)" />
          </>
        )}
      </div>

      )} {/* end execucoes tab */}

      {addModal  && <AddCasesModal cycleId={cycle.id} existingIds={existingIds} projectId={currentProject?.id} onClose={()=>setAddModal(false)} onAdded={()=>{refetch();onRefresh();}} />}
      {execModal && <ExecutionModal cycleId={cycle.id} execution={execModal} onClose={()=>setExecModal(null)} onSaved={()=>{refetch();onRefresh();}} />}
      {tcModal   && <TCDetailModal execution={tcModal} onClose={()=>setTcModal(null)} />}
      {confirm   && <ConfirmModal message={`Remover "${confirm.test_case_title}" deste ciclo?`} onConfirm={async()=>{await cyclesApi.deleteExecution(cycle.id,confirm.id);setConfirm(null);refetch();}} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

export default function Cycles() {
  const { user }           = useAuth();
  const { currentProject } = useProject();
  const navigate           = useNavigate();
  const pid      = currentProject?.id;
  const isViewer  = user?.role === "viewer";
  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: cycles, loading, error, refetch } = useAsync(()=>cyclesApi.list(pid?{project_id:pid}:{}), [pid]);
  const [plansMap, setPlansMap] = useState<Record<number,boolean>|null>(null);

  // Verifica quais ciclos têm plano de teste
  const cyclesList = cycles || [];
  useEffect(() => {
    if (!cyclesList.length) return;
    Promise.all(cyclesList.map((c: any) =>
      testPlansApi.get(c.id).then((r: any) => {
        const p = r?.data ?? r;
        return { id: c.id, has: !!(p?.objective) };
      }).catch(() => ({ id: c.id, has: false }))
    )).then(results => {
      const map: Record<number,boolean> = {};
      results.forEach(r => { map[r.id] = r.has; });
      setPlansMap(map);
    });
  }, [cyclesList.length]);
  const [modal,   setModal]   = useState<CycleModalState | null>(null);
  const [confirm, setConfirm] = useState<CycleWithStats | null>(null);
  const [detail,  setDetail]  = useState<CycleWithStats | null>(null);
  const [search,  setSearch]  = useState("");
  const [filterVersion, setFilterVersion] = useState("");
  const [activeTab, setActiveTab] = useState("active"); // "active" | "finished"
  const [page,    setPage]    = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;
  if (detail)  return <CycleDetail cycle={detail} onBack={()=>setDetail(null)} onRefresh={refetch} />;

  // Separar ciclos por aba
  const activeCycles   = (cycles||[]).filter(c => c.status === "active");
  const finishedCycles = (cycles||[]).filter(c => c.status === "completed" || c.status === "archived");

  const sourceList = activeTab === "active" ? activeCycles : finishedCycles;

  const filtered = sourceList.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterVersion && !(c.version||"").toLowerCase().includes(filterVersion.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      const payload = {...form, project_id:pid};
      if (modal.mode==="create") await cyclesApi.create(payload);
      else                        await cyclesApi.update(modal.item.id, form);
      setModal(null); refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const tabStyle = (tab) => ({
    padding:"8px 20px",fontSize:13,fontWeight:500,cursor:"pointer",
    border:"none",background:"none",borderBottom: activeTab===tab
      ? "2px solid var(--accent)" : "2px solid transparent",
    color: activeTab===tab ? "var(--accent)" : "var(--text-muted)",
    transition:"all .15s"
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Ciclos de Teste</h1>
        {!isViewer && (
          <button className="btn btn-primary" onClick={()=>setModal({mode:"create"})}>+ Novo ciclo</button>
        )}
      </div>
      {err && <ErrorMsg msg={err} />}

      {/* Abas */}
      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:16}}>
        <button style={tabStyle("active")} onClick={()=>{ setActiveTab("active"); setPage(1); }}>
          🔁 Em andamento
          <span style={{marginLeft:6,fontSize:11,background:"var(--accent-bg)",
            color:"var(--accent)",borderRadius:10,padding:"1px 7px"}}>
            {activeCycles.length}
          </span>
        </button>
        <button style={tabStyle("finished")} onClick={()=>{ setActiveTab("finished"); setPage(1); }}>
          ✅ Finalizados
          <span style={{marginLeft:6,fontSize:11,background:"var(--bg)",
            color:"var(--text-muted)",borderRadius:10,padding:"1px 7px",
            border:"1px solid var(--border)"}}>
            {finishedCycles.length}
          </span>
        </button>
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Buscar por nome..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,minWidth:200,flex:1}} />
        <input value={filterVersion} onChange={e=>{ setFilterVersion(e.target.value); setPage(1); }}
          placeholder="📦 Filtrar por versão..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,width:180}} />
        {(search||filterVersion) && (
          <button onClick={()=>{ setSearch(""); setFilterVersion(""); setPage(1); }}
            style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--danger)",
              color:"var(--danger)",background:"none",fontSize:13,cursor:"pointer"}}>
            ✕ Limpar
          </button>
        )}
        <span style={{fontSize:12,color:"var(--text-muted)",alignSelf:"center"}}>{filtered.length} ciclo(s)</span>
      </div>

      <div className="card">
        {!filtered.length ? (
          <Empty icon="🔁" text={activeTab==="active" ? "Nenhum ciclo em andamento." : "Nenhum ciclo finalizado."} />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nome</th><th>Versão</th><th>Período</th><th>Tipos</th><th>Status</th><th>Progresso</th><th></th></tr>
                </thead>
                <tbody>
                  {paged.map(c => {
                    const exec    = c.total_executions||0;
                    const executed = exec - (c.not_executed||0); // exclui não executados
                    const pct  = executed>0?Math.round(((c.passed||0)/executed)*100):0;
                    const types = c.test_types?c.test_types.split(",").filter(Boolean):[];
                    return (
                      <tr key={c.id}>
                        <td>
                          <button style={{background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:13,color:"var(--accent)",padding:0}}
                            onClick={()=>setDetail(c)}>{c.name}</button>
                          {c.description&&<div style={{fontSize:11,color:"var(--text-muted)"}}>{c.description}</div>}
                        </td>
                        <td style={{fontSize:12,color:"var(--text-muted)"}}>
                          {c.version ? (
                            <div style={{position:"relative",display:"inline-block"}}>
                              <style>{`.cv-wrap:hover .cv-tip{display:block!important}`}</style>
                              <div className="cv-wrap" style={{display:"inline-block"}}>
                                <span style={{cursor:"help",color:"var(--accent)",fontWeight:500}}>v{c.version} ℹ️</span>
                                <div className="cv-tip" style={{display:"none",position:"absolute",left:"110%",top:"50%",transform:"translateY(-50%)",
                                  background:"#1E293B",color:"white",borderRadius:8,padding:"12px 16px",
                                  fontSize:12,whiteSpace:"nowrap",zIndex:200,boxShadow:"0 4px 16px rgba(0,0,0,.3)",minWidth:220}}>
                                  <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>📦 v{c.version}</div>
                                  {(() => {
                                    const exec = (c.total_executions||0) - (c.not_executed||0);
                                    const pct = exec > 0 ? Math.round(((c.passed||0)/exec)*100) : 0;
                                    const fPct = exec > 0 ? Math.round(((c.failed||0)/exec)*100) : 0;
                                    return <>
                                      <div style={{marginBottom:4}}>✅ Sucesso: <strong>{pct}%</strong></div>
                                      <div style={{marginBottom:4}}>❌ Falha: <strong>{fPct}%</strong></div>
                                      <div style={{marginBottom:4}}>🔢 Executados: <strong>{exec}</strong></div>
                                      <div style={{marginBottom:4}}>⏳ Não executados: <strong>{c.not_executed||0}</strong></div>
                                      <div>📊 Total: <strong>{c.total_executions||0}</strong></div>
                                    </>;
                                  })()}
                                </div>
                              </div>
                            </div>
                          ) : "—"}
                        </td>
                        <td style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>
                          {c.start_date?new Date(c.start_date + "T12:00:00").toLocaleDateString("pt-BR"):"—"}
                          {c.end_date?` → ${new Date(c.end_date + "T12:00:00").toLocaleDateString("pt-BR")}` :""}
                        </td>
                        <td>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {types.slice(0,2).map(t=><span key={t} style={{fontSize:10,padding:"1px 6px",background:"var(--accent-bg)",color:"var(--accent)",borderRadius:10}}>{t}</span>)}
                            {types.length>2&&<span style={{fontSize:10,color:"var(--text-muted)"}}>+{types.length-2}</span>}
                          </div>
                        </td>
                        <td><CycleBadge v={c.status} /></td>
                        <td style={{minWidth:120}}>
                          {(() => {
                            const barColor = pct >= 70 ? "#16A34A" : pct >= 40 ? "#D97706" : exec > 0 ? "#DC2626" : "var(--border)";
                            const tooltipMsg = exec === 0
                              ? "Nenhum caso executado ainda."
                              : pct >= 70
                              ? `✅ Boa qualidade — ${pct}% dos casos executados passaram.`
                              : pct >= 40
                              ? `⚠ Atenção — ${pct}% passaram. Taxa entre 40% e 69%.`
                              : `🔴 Crítico — apenas ${pct}% passaram. Taxa abaixo de 40%.`;
                            const notExec = c.not_executed||0;
                            const fullMsg = `${tooltipMsg}${notExec > 0 ? ` (${notExec} ainda não executado${notExec>1?"s":""})` : ""}`;
                            return (
                              <div title={fullMsg} style={{cursor:"help"}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <div className="progress" style={{flex:1}}>
                                    <div className="progress-fill" style={{width:`${pct}%`,background:barColor}} />
                                  </div>
                                  <span style={{fontSize:11,color:barColor,minWidth:28,fontWeight:pct>0?600:400}}>{pct}%</span>
                                </div>
                                <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>
                                  <span style={{color:"var(--success)"}}>{c.passed||0}✓</span>{" "}
                                  <span style={{color:"var(--danger)"}}>{c.failed||0}✗</span>{" "}
                                  {c.blocked||0 > 0 && <span style={{color:"var(--warning)"}}>{c.blocked}⊘{" "}</span>}
                                  — {exec} total
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <div className="actions">
                            <button className="btn btn-sm" onClick={()=>setDetail(c)}>▶ Abrir</button>
                            <a href={`/qa-manager/cycles/${c.id}/test-plan`} className="btn btn-sm"
                              style={{fontSize:11,textDecoration:"none",
                                background:plansMap===null?"var(--bg)":plansMap[c.id]?"#D1FAE5":"#FEF3C7",
                                color:plansMap===null?"var(--text-muted)":plansMap[c.id]?"#065F46":"#92400E",
                                border:`1px solid ${plansMap===null?"var(--border)":plansMap[c.id]?"#6EE7B7":"#FDE68A"}`}}
                              title={plansMap===null?"Carregando...":plansMap[c.id]?"Plano criado":"Criar Plano de Teste"}>
                              {plansMap === null ? "📝 Plano" : plansMap[c.id] ? "✅ Plano" : "⚠️ Plano"}
                            </a>
                            {!isViewer && (
                              <button className="btn btn-sm" onClick={()=>setModal({mode:"edit",item:c})}>✏</button>
                            )}
                            {canManage && (
                              <button className="btn btn-sm btn-danger" onClick={()=>setConfirm(c)}>🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} label="ciclo(s)" />
          </>
        )}
      </div>

      {modal&&<Modal title={modal.mode==="create"?"Novo ciclo":"Editar ciclo"} onClose={()=>setModal(null)}>
        <CycleForm initial={modal.item||{}} onSave={handleSave} onCancel={()=>setModal(null)} saving={saving} />
      </Modal>}
      {confirm&&<ConfirmModal message={`Excluir "${confirm.name}" e todas as execuções?`}
        onConfirm={async()=>{await cyclesApi.delete(confirm.id);setConfirm(null);refetch();}} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

