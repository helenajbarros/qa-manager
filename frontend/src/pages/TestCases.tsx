import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { useAsync }    from "../hooks/useAsync.js";
import { testCasesApi, modulesApi, usersApi } from "../services/resources.js";
import { useProject }  from "../context/ProjectContext.js";
import { useAuth }     from "../context/AuthContext.js";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field, Select, Priority } from "../components/UI.js";
import type { TestCase, Module, MentionUser } from "../types/index.js";

interface ActivityEntry {
  user_name?: string;
  action: string;
  detail?: string;
  created_at: string;
}

interface TestCaseFormData {
  title: string;
  description: string;
  preconditions: string;
  steps: string;
  expected_result: string;
  module_id: string;
  priority: string;
  assigned_to_id: string;
}

interface TestCaseFormProps {
  initial?: Partial<TestCase>;
  modules: Module[];
  users: MentionUser[];
  onSave: (form: TestCaseFormData) => void;
  onCancel: () => void;
  saving: boolean;
}

type ModalState = { mode: "create"; item?: null } | { mode: "edit"; item: TestCase };

const PRI_OPTS = [
  {value:"low",label:"Baixa"},{value:"medium",label:"Média"},
  {value:"high",label:"Alta"},{value:"critical",label:"Crítica"}
];
const PAGE_SIZE = 10;

function Pagination({ page, totalPages, total, onChange, pageSize, onPageSizeChange }) {
  if (totalPages <= 1 && !onPageSizeChange) return null;
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"12px 0 0",fontSize:12,color:"var(--text-muted)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span>{total} item(s) — Página {page} de {totalPages}</span>
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

function TestCaseForm({ initial = {}, modules, users, onSave, onCancel, saving }: TestCaseFormProps) {
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
  const set = (k: keyof TestCaseFormData) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({...f, [k]: e.target.value}));
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
  const isViewer  = user?.role === "viewer";
  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: casesRaw,  loading:l1, error:e1, refetch } = useAsync(() => testCasesApi.list(pid?{project_id:pid, limit:9999}:{limit:9999}), [pid]);
  const { data: modules,   loading:l2, error:e2 }          = useAsync(() => modulesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: usersRaw } = useAsync<MentionUser[]>(() => usersApi.mentions() as Promise<MentionUser[]>);
  const cases = casesRaw?.data ?? casesRaw;
  const users = usersRaw?.data ?? usersRaw;

  const [modal,     setModal]     = useState<ModalState | null>(null);
  const [confirm,   setConfirm]   = useState<TestCase | null>(null);
  const [detail,    setDetail]    = useState<TestCase | null>(null);
  const [detailTab, setDetailTab] = useState("info");
  const [activity,  setActivity]  = useState<ActivityEntry[]>([]);
  const [actLoading,setActLoading]= useState(false);
  const [search,    setSearch]    = useState("");
  const [filterMod, setFilterMod] = useState("");
  const [filterPri, setFilterPri] = useState("");
  const [page,      setPage]      = useState(1);
  const [pageSize,  setPageSize]  = useState(10);
  const [showExport, setShowExport] = useState(false);

  function exportExcel() {
    const XLSX = (window as any).XLSX;
    const rows = filtered.map(tc => ({
      ID: tc.id,
      Titulo: tc.title,
      Modulo: (modules as Module[])?.find(m => m.id === tc.module_id)?.name || "—",
      Prioridade: tc.priority === "low" ? "Baixa" : tc.priority === "medium" ? "Média" : tc.priority === "high" ? "Alta" : "Crítica",
      Precondicoes: tc.preconditions || "—",
      Passos: tc.steps || "—",
      Resultado_Esperado: tc.expected_result || "—",
      Responsavel: tc.assigned_to_name || "—",
      Criado_em: new Date(tc.created_at).toLocaleDateString("pt-BR"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:6},{wch:40},{wch:16},{wch:10},{wch:30},{wch:50},{wch:50},{wch:20},{wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Casos de Teste");
    const date = new Date().toLocaleDateString("pt-BR").replace(/\//g,"-");
    XLSX.writeFile(wb, `Casos_de_Teste_${date}.xlsx`);
    setShowExport(false);
  }

  async function loadXLSX() {
    if ((window as any).XLSX) return (window as any).XLSX;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => resolve((window as any).XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function handleExportExcel() {
    await loadXLSX();
    exportExcel();
  }

  function exportHTML() {
    const pri: Record<string,string> = {low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
    const rows = filtered.map(tc => {
      const mod = (modules as Module[])?.find(m => m.id === tc.module_id)?.name || "—";
      return `<tr>
        <td>${tc.id}</td>
        <td>${tc.title}</td>
        <td>${mod}</td>
        <td>${pri[tc.priority]||tc.priority}</td>
        <td style="white-space:pre-wrap">${tc.preconditions||"—"}</td>
        <td style="white-space:pre-wrap">${tc.steps||"—"}</td>
        <td style="white-space:pre-wrap">${tc.expected_result||"—"}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Casos de Teste</title>
    <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;color:#1E293B}
    h1{font-size:20px;margin-bottom:16px;color:#1E3A5F}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#1E3A5F;color:white;padding:8px 10px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #E5E7EB;vertical-align:top}
    tr:nth-child(even) td{background:#F8FAFC}
    @media print{body{padding:0}}</style></head><body>
    <h1>Casos de Teste — ${currentProject?.name || ""}</h1>
    <p style="font-size:12px;color:#64748B;margin-bottom:16px">Gerado em ${new Date().toLocaleString("pt-BR")} — ${filtered.length} caso(s)</p>
    <table><thead><tr><th>ID</th><th>Título</th><th>Módulo</th><th>Prioridade</th><th>Pré-condições</th><th>Passos</th><th>Resultado Esperado</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="text-align:center;margin-top:24px">
      <button onclick="window.print()" style="background:#1E3A5F;color:white;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
    </div></body></html>`;
    const blob = new Blob([html], {type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Casos_de_Teste_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  }
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  if (l1||l2) return <Loading />;
  if (e1||e2) return <ErrorMsg msg={e1||e2} />;

  const filtered = (cases||[]).filter(c => {
    if (filterMod && String(c.module_id) !== filterMod) return false;
    if (filterPri && c.priority !== filterPri)           return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
        !String(c.id).includes(search)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged      = filtered.slice((page-1)*pageSize, page*pageSize);

  function handleFilterChange(fn) {
    fn();
    setPage(1);
  }

  async function handleSave(form: TestCaseFormData) {
    setSaving(true); setErr(null);
    try {
      if (modal.mode==="create") await testCasesApi.create(form);
      else                        await testCasesApi.update(modal.item.id, form);
      setModal(null); refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await testCasesApi.delete(id); setConfirm(null); refetch(); }
    catch(e) { setErr(e.message); }
  }

  async function openDetail(tc: TestCase) {
    setDetail(tc);
    setDetailTab("info");
    setActivity([]);
    setActLoading(true);
    try {
      const rows = await testCasesApi.getActivity(tc.id) as ActivityEntry[];
      setActivity(Array.isArray(rows) ? rows : (rows as any)?.data ?? []);
    } catch(_) {}
    finally { setActLoading(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Casos de Teste</h1>
        <div style={{display:"flex",gap:8,alignItems:"center",position:"relative"}}>
          <div style={{position:"relative"}}>
            <button className="btn" onClick={()=>setShowExport(v=>!v)}
              style={{background:"#1E3A5F",color:"white",border:"none",fontWeight:600}}>
              ⬇ Exportar ▾
            </button>
            {showExport && (
              <>
              <div onClick={()=>setShowExport(false)} style={{position:"fixed",inset:0,zIndex:99,background:"rgba(0,0,0,0.3)"}} />
              <div style={{position:"absolute",right:0,top:"110%",background:"#ffffff",
                border:"1px solid #E5E7EB",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)",
                zIndex:100,minWidth:160,overflow:"hidden"}}>
                <button onClick={handleExportExcel}
                  onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}
                  style={{display:"block",width:"100%",padding:"10px 16px",textAlign:"left",
                    background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                  📊 Excel (.xlsx)
                </button>
                <button onClick={exportHTML}
                  onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}
                  style={{display:"block",width:"100%",padding:"10px 16px",textAlign:"left",
                    background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                  📄 HTML + PDF
                </button>
              </div>
              </>
            )}
          </div>
          {!isViewer && (
            <button className="btn btn-primary" onClick={() => setModal({mode:"create"})}>+ Novo caso</button>
          )}
        </div>
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
                        <button onClick={() => openDetail(c)}
                          style={{background:"none",border:"none",cursor:"pointer",
                            color:"var(--accent)",fontWeight:700,fontSize:13,padding:0}}>
                          {c.id}
                        </button>
                      </td>
                      <td style={{fontWeight:500,maxWidth:280}}>
                        <button onClick={() => openDetail(c)}
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
                            {canManage && (
                              <button className="btn btn-sm btn-danger" onClick={() => setConfirm(c)}>🗑</button>
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

      {detail && (
        <div className="modal-overlay" onClick={(e: any) => e.target===e.currentTarget && setDetail(null)}>
          <div className="modal" style={{maxWidth:620}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:12,color:"var(--accent)",fontWeight:600,marginBottom:4}}>
                  ID #{(detail as any).id} — {(detail as any).module_name}
                </div>
                <h3 style={{margin:0}}>{(detail as any).title}</h3>
              </div>
              <Priority v={(detail as any).priority} />
            </div>
            <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid var(--border)",paddingBottom:0}}>
              {["info","historico"].map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  style={{padding:"6px 16px",border:"none",background:"none",cursor:"pointer",
                    fontSize:13,fontWeight:detailTab===tab?600:400,
                    color:detailTab===tab?"var(--accent)":"var(--text-muted)",
                    borderBottom:detailTab===tab?"2px solid var(--accent)":"2px solid transparent",
                    marginBottom:-1}}>
                  {tab==="info" ? "📋 Informações" : "📜 Histórico"}
                </button>
              ))}
            </div>
            {detailTab === "info" && (
              <>
                {(detail as any).assigned_to_name && (
                  <div style={{background:"var(--accent-bg)",borderRadius:6,padding:"6px 12px",
                    fontSize:12,color:"var(--accent)",marginBottom:12}}>
                    👤 Responsável: <strong>{(detail as any).assigned_to_name}</strong>
                  </div>
                )}
                {[
                  {label:"Descrição",value:(detail as any).description},
                  {label:"Pré-condições",value:(detail as any).preconditions},
                  {label:"Passos",value:(detail as any).steps},
                  {label:"Resultado esperado",value:(detail as any).expected_result},
                ].map(({label,value}) => value ? (
                  <div key={label} style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
                      textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:13,whiteSpace:"pre-line",background:"var(--bg)",
                      padding:"8px 12px",borderRadius:6}}>{value}</div>
                  </div>
                ) : null)}
              </>
            )}
            {detailTab === "historico" && (
              <div style={{minHeight:120}}>
                {actLoading ? (
                  <div style={{textAlign:"center",padding:24,color:"var(--text-muted)",fontSize:13}}>Carregando...</div>
                ) : activity.length === 0 ? (
                  <div style={{textAlign:"center",padding:24,color:"var(--text-muted)",fontSize:13}}>Nenhuma atividade registrada.</div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {activity.map((a: any,i: number) => (
                      <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",
                        padding:"8px 10px",borderRadius:6,background:"var(--bg)"}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:"var(--accent)",
                          color:"white",display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:11,fontWeight:700,flexShrink:0}}>
                          {(a.user_name||"?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13}}>
                            <strong>{a.user_name||"Sistema"}</strong>{" "}
                            <span style={{color:"var(--text-muted)"}}>{a.action}</span>
                            {a.detail && <span style={{fontSize:12,color:"var(--text-muted)"}}>{" — "}{a.detail}</span>}
                          </div>
                          <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                            {new Date(a.created_at).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
