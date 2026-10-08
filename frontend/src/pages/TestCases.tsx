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
          <Select data-testid="select-caso-prioridade" value={form.priority} onChange={v => setForm(f=>({...f,priority:v}))} options={PRI_OPTS} />
        </Field>
      </div>
      <Field label="Título *">
        <input data-testid="input-caso-titulo" value={form.title} onChange={set("title")} autoFocus placeholder="Ex: Login com credenciais válidas" />
      </Field>
      <Field label="Responsável pelo teste">
        <Select value={form.assigned_to_id} onChange={v => setForm(f=>({...f,assigned_to_id:v}))}
          options={users.map(u=>({value:u.id,label:u.name}))} placeholder="Não atribuído" />
      </Field>
      <Field label="Descrição">
        <textarea value={form.description} onChange={set("description")} placeholder="Objetivo do teste..." />
      </Field>
      <Field label="Pré-condições">
        <textarea data-testid="textarea-caso-precondicoes" value={form.preconditions} onChange={set("preconditions")} placeholder="O que precisa estar configurado..." />
      </Field>
      <Field label="Passos">
        <textarea data-testid="textarea-caso-passos" value={form.steps} onChange={set("steps")} style={{minHeight:100}}
          placeholder="1. Acesse a página&#10;2. Clique em..." />
      </Field>
      <Field label="Resultado esperado">
        <textarea data-testid="textarea-caso-resultado" value={form.expected_result} onChange={set("expected_result")} placeholder="O que deve acontecer..." />
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
  const [showAI,     setShowAI]     = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading,  setAiLoading]  = useState(false);

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

  async function analyzeWithAI() {
    setShowAI(true);
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
      const token = localStorage.getItem("qa_token");
      const res = await fetch(`${base}/ai/analyze?project_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      setAiAnalysis(json.data ?? json);
    } catch(e: any) {
      setAiAnalysis(null);
    } finally {
      setAiLoading(false);
    }
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
   window.open(url, "_blank");
    setShowExport(false);
  }
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  // --- Import Excel state ---
  const [importStep,     setImportStep]     = useState<"idle"|"mapping"|"importing"|"done">("idle");
  const [importFile,     setImportFile]     = useState<File | null>(null);
  const [importCols,     setImportCols]     = useState<string[]>([]);
  const [importPreview,  setImportPreview]  = useState<Record<string,string>[]>([]);
  const [importTotal,    setImportTotal]    = useState(0);
  const [importMapping,  setImportMapping]  = useState<Record<string,string>>({});
  const [importResult,   setImportResult]   = useState<{success:number;errors:Array<{row:number;message:string}>}|null>(null);
  const [importErr,      setImportErr]      = useState<string|null>(null);
  const [importLoading,  setImportLoading]  = useState(false);
  const [genLoading,     setGenLoading]     = useState(false);
  const [genResult,      setGenResult]      = useState<{created:number;skipped:number}|null>(null);
  const [selectedSugg,   setSelectedSugg]   = useState<Set<number>>(new Set());

  const IMPORT_FIELDS = [
    { key: "title",           label: "Título *",           required: true  },
    { key: "module",          label: "Módulo",             required: false },
    { key: "description",     label: "Descrição",          required: false },
    { key: "preconditions",   label: "Pré-condições",      required: false },
    { key: "steps",           label: "Passos",             required: false },
    { key: "expected_result", label: "Resultado esperado", required: false },
    { key: "priority",        label: "Prioridade",         required: false },
  ];

  function openImport() {
    setImportStep("idle");
    setImportFile(null);
    setImportCols([]);
    setImportPreview([]);
    setImportMapping({});
    setImportResult(null);
    setImportErr(null);
    document.getElementById("import-excel-input")?.click();
  }

  async function handleImportFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportLoading(true);
    setImportErr(null);
    try {
      const parsed = await testCasesApi.parseExcel(file);
      setImportCols(parsed.columns || []);
      setImportPreview(parsed.preview || []);
      setImportTotal(parsed.total || 0);
      // auto-map obvious columns
      const autoMap: Record<string,string> = {};
      const lower = (s: string) => s.toLowerCase().trim();
      const HINTS: Record<string, string[]> = {
        title:           ["título","titulo","title","nome","name","caso","test case"],
        module:          ["módulo","modulo","module","área","area","categoria","feature"],
        description:     ["descrição","descricao","description","desc","objetivo"],
        preconditions:   ["pré-condições","pre-condicoes","preconditions","pré-condição","precondição","pre-requisitos","pré-requisitos"],
        steps:           ["passos","steps","passo","procedimento","etapas"],
        expected_result: ["resultado esperado","expected result","resultado","expected","resultado_esperado"],
        priority:        ["prioridade","priority","prio"],
      };
      for (const [field, hints] of Object.entries(HINTS)) {
        const match = parsed.columns.find((c: string) => hints.some(h => lower(c).includes(h)));
        if (match) autoMap[field] = match;
      }
      setImportMapping(autoMap);
      setImportStep("mapping");
    } catch(err: any) {
      setImportErr("Erro ao ler arquivo: " + (err.message || String(err)));
    } finally {
      setImportLoading(false);
      e.target.value = "";
    }
  }

  async function handleImportConfirm() {
    if (!importFile || !pid) return;
    setImportStep("importing");
    setImportLoading(true);
    setImportErr(null);
    try {
      const result = await testCasesApi.importExcel(importFile, pid, importMapping);
      setImportResult(result);
      setImportStep("done");
      if (result.success > 0) refetch();
    } catch(err: any) {
      setImportErr("Erro na importação: " + (err.message || String(err)));
      setImportStep("mapping");
    } finally {
      setImportLoading(false);
    }
  }

  if (l1||l2) return <Loading />;
  if (e1||e2) return <ErrorMsg msg={e1||e2} />;

  const filtered = (cases||[]).filter(c => {
    if (filterMod && String(c.module_id) !== filterMod) return false;
    if (filterPri && c.priority !== filterPri)           return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) &&
        !String(c.id).includes(search)) return false;
    return true;
  });

  const sortedCases = [...filtered].sort((a,b) => new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime());
  const totalPages = Math.ceil(sortedCases.length / pageSize);
  const paged      = sortedCases.slice((page-1)*pageSize, page*pageSize);

  function handleFilterChange(fn) {
    fn();
    setPage(1);
  }

  async function generateSuggestedCases(indices: number[]) {
    if (!aiAnalysis?.suggestions?.length || !pid) return;
    setGenLoading(true); setGenResult(null);
    let created = 0; let skipped = 0;
    const modList = [...(modules || [])];
    async function getOrCreateMod(name: string): Promise<number | null> {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = modList.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;
      try {
        const novo = await modulesApi.create({ name: trimmed, project_id: Number(pid) });
        modList.push(novo as any); return (novo as any).id;
      } catch { return null; }
    }
    const toCreate = indices.map(i => aiAnalysis.suggestions[i]).filter(Boolean);
    for (const s of toCreate) {
      const clean = s.replace(/<[^>]+>/g, "");
      const match = clean.match(/^\*?\*?([^*]+)\*?\*?\s*[—–-]\s*(.+)$/);
      if (!match) { skipped++; continue; }
      const moduleName = match[1].trim();
      const title = match[2].replace(/^(Adicionar caso para:|Criar caso para:|Adicionar:|Criar:)\s*/i, "").trim();
      if (!title) { skipped++; continue; }
      if ((cases || []).find(c => c.title.toLowerCase() === title.toLowerCase())) { skipped++; continue; }
      const module_id = await getOrCreateMod(moduleName);
      if (!module_id) { skipped++; continue; }
      try { await testCasesApi.create({ title, module_id, priority: "medium" }); created++; }
      catch { skipped++; }
    }
    setGenResult({ created, skipped }); setGenLoading(false);
    if (created > 0) refetch();
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
          <button className="btn" onClick={analyzeWithAI}
            style={{background:"#7C3AED",color:"white",border:"none",fontWeight:600}}>
            🎯 Relatório de Gaps
          </button>
          {!isViewer && (
            <>
              <input id="import-excel-input" type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleImportFileSelect} />
              <button className="btn" onClick={openImport} title="Importar casos de teste via Excel"
                style={{background:"#059669",color:"white",border:"none",fontWeight:600}}>
                {importLoading ? "⏳" : "⬆"} Importar Excel
              </button>
              <button data-testid="btn-novo-caso" className="btn btn-primary" onClick={() => setModal({mode:"create"})}>+ Novo caso</button>
            </>
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

      {/* Modal Import Excel */}
      {(importStep === "mapping" || importStep === "importing" || importStep === "done") && (
        <div className="modal-overlay" onClick={(e: any) => {
          if (importStep !== "importing" && e.target === e.currentTarget) {
            setImportStep("idle");
          }
        }}>
          <div className="modal" style={{maxWidth:680}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0}}>⬆ Importar casos de teste via Excel</h3>
              {importStep !== "importing" && (
                <button className="btn btn-sm" onClick={() => setImportStep("idle")}>✕</button>
              )}
            </div>

            {importStep === "done" && importResult ? (
              <div style={{textAlign:"center",padding:"16px 0"}}>
                <div style={{fontSize:48,marginBottom:12}}>{importResult.success > 0 ? "✅" : "⚠️"}</div>
                <div style={{fontWeight:700,fontSize:18,marginBottom:8}}>
                  {importResult.success} caso(s) importado(s) com sucesso
                </div>
                {importResult.errors.length > 0 && (
                  <div style={{textAlign:"left",marginTop:16}}>
                    <div style={{fontWeight:600,color:"#EF4444",marginBottom:8}}>
                      {importResult.errors.length} linha(s) com erro:
                    </div>
                    <div style={{maxHeight:200,overflowY:"auto",background:"var(--bg)",borderRadius:6,padding:"8px 12px"}}>
                      {importResult.errors.map((e,i) => (
                        <div key={i} style={{fontSize:12,color:"#EF4444",padding:"3px 0",borderBottom:"1px solid var(--border)"}}>
                          Linha {e.row}: {e.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary" style={{marginTop:20}} onClick={() => setImportStep("idle")}>Fechar</button>
              </div>
            ) : importStep === "importing" ? (
              <div style={{textAlign:"center",padding:"32px 0"}}>
                <div style={{fontSize:32,marginBottom:12}}>⏳</div>
                <div style={{fontSize:14,color:"var(--text-muted)"}}>Importando {importTotal} linha(s)...</div>
              </div>
            ) : (
              <>
                <div style={{marginBottom:12,fontSize:13,color:"var(--text-muted)"}}>
                  Arquivo: <strong>{importFile?.name}</strong> — <strong>{importTotal}</strong> linha(s) detectadas
                </div>

                {importErr && (
                  <div style={{background:"#FEF2F2",border:"1px solid #EF4444",borderRadius:6,
                    padding:"8px 12px",fontSize:13,color:"#DC2626",marginBottom:12}}>{importErr}</div>
                )}

                <div style={{marginBottom:16}}>
                  <div style={{fontWeight:600,marginBottom:10,fontSize:13}}>Mapeamento de colunas</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {IMPORT_FIELDS.map(f => (
                      <div key={f.key} style={{display:"flex",flexDirection:"column",gap:4}}>
                        <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)"}}>
                          {f.label}{f.required && <span style={{color:"#EF4444"}}> *</span>}
                        </label>
                        <select
                          value={importMapping[f.key] || ""}
                          onChange={e => setImportMapping(m => ({...m, [f.key]: e.target.value}))}
                          style={{padding:"5px 8px",borderRadius:6,border:"1px solid var(--border)",
                            fontSize:12,background:"var(--card)",color:"var(--text)"}}>
                          <option value="">— não importar —</option>
                          {importCols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {importPreview.length > 0 && importMapping.title && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>Preview (primeiras {importPreview.length} linhas)</div>
                    <div style={{overflowX:"auto",borderRadius:6,border:"1px solid var(--border)"}}>
                      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
                        <thead>
                          <tr style={{background:"var(--bg)"}}>
                            {["title","module","priority","steps"].filter(k => importMapping[k]).map(k => (
                              <th key={k} style={{padding:"5px 8px",textAlign:"left",fontWeight:600,
                                color:"var(--text-muted)",borderBottom:"1px solid var(--border)"}}>
                                {IMPORT_FIELDS.find(f=>f.key===k)?.label.replace(" *","")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((row, i) => (
                            <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                              {["title","module","priority","steps"].filter(k => importMapping[k]).map(k => (
                                <td key={k} style={{padding:"5px 8px",maxWidth:200,overflow:"hidden",
                                  textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  {row[importMapping[k]] || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="modal-footer">
                  <button className="btn" onClick={() => setImportStep("idle")}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleImportConfirm}
                    disabled={!importMapping.title}>
                    ✓ Importar {importTotal} caso(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAI && (
        <Modal title="🎯 Relatório de Gaps — Casos de Teste" onClose={()=>{ setShowAI(false); setAiAnalysis(null); }}>
          <div style={{maxHeight:"60vh",overflowY:"auto",padding:"8px 0"}}>
            {aiLoading ? (
              <div style={{textAlign:"center",padding:40}}>
                <div style={{fontSize:32,marginBottom:12}}>🤖</div>
                <div style={{fontSize:14,color:"var(--text-muted)"}}>Gerando relatório de gaps...</div>
              </div>
            ) : aiAnalysis && aiAnalysis.summary?.total_modules === 0 ? (
              <div style={{textAlign:"center",padding:32}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>Projeto sem módulos</div>
                <div style={{fontSize:13,color:"var(--text-muted)"}}>Cadastre módulos e casos de teste para gerar o relatório de gaps.</div>
              </div>
            ) : aiAnalysis ? (
              <div style={{fontSize:13,lineHeight:1.8}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
                  {[
                    ["📋","Módulos",aiAnalysis.summary?.total_modules],
                    ["🔢","Casos",aiAnalysis.summary?.total_cases],
                    ["🐛","Bugs",aiAnalysis.summary?.total_bugs],
                    ["⏳","Não exec.",aiAnalysis.summary?.never_executed,"Casos que nunca foram executados em nenhum ciclo de teste"],
                  ].map(([icon,label,val,tooltip]) => (
                    <div key={label as string} title={tooltip as string || ""}
                      style={{textAlign:"center",padding:"10px 8px",background:"var(--bg)",borderRadius:8,
                        border:"1px solid var(--border)",cursor:tooltip?"help":"default"}}>
                      <div style={{fontSize:20}}>{icon}</div>
                      <div style={{fontSize:18,fontWeight:700}}>{val}</div>
                      <div style={{fontSize:11,color:"var(--text-muted)"}}>{label}</div>
                    </div>
                  ))}
                </div>
                {aiAnalysis.high_priority?.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontWeight:700,color:"#EF4444",marginBottom:8}}>🔴 Alta Prioridade</div>
                    {aiAnalysis.high_priority.map((m: any,i: number) => (
                      <div key={i} style={{padding:"8px 12px",background:"#FEF2F2",borderRadius:6,marginBottom:6,borderLeft:"3px solid #EF4444",fontSize:12}}>
                        <strong>{m.module}</strong> — {m.cases} casos — {m.reason}
                      </div>
                    ))}
                  </div>
                )}
                {aiAnalysis.never_executed?.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontWeight:700,color:"#6B7280",marginBottom:8}}>⏳ Nunca executados</div>
                    {aiAnalysis.never_executed.map((tc: any,i: number) => (
                      <div key={i} style={{padding:"6px 12px",background:"var(--bg)",borderRadius:6,marginBottom:4,borderLeft:"3px solid #6B7280",fontSize:12}}>
                        [{tc.module}] {tc.title}
                      </div>
                    ))}
                  </div>
                )}
                {aiAnalysis.gaps?.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontWeight:700,color:"#2563EB",marginBottom:8}}>🔍 Gaps Identificados</div>
                    {aiAnalysis.gaps.map((g: string,i: number) => (
                      <div key={i} style={{padding:"6px 12px",background:"#EFF6FF",borderRadius:6,marginBottom:4,borderLeft:"3px solid #2563EB",fontSize:12}}
                        dangerouslySetInnerHTML={{__html: g.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}} />
                    ))}
                  </div>
                )}
                {(aiAnalysis.suggestions?.length > 0 || (aiAnalysis.summary?.total_cases > 0 && aiAnalysis.summary?.total_modules > 0)) && (
                <div>
                  <div style={{fontWeight:700,color:"#10B981",marginBottom:8}}>💡 Sugestões</div>
                  {aiAnalysis.suggestions?.length > 0 ? (<>
                    {/* Barra de ações */}
                    {!genResult && (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        marginBottom:8,padding:"6px 10px",background:"#F0FDF4",borderRadius:6,
                        border:"1px solid #6EE7B7",flexWrap:"wrap",gap:6}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}>
                          <button style={{fontSize:11,padding:"2px 8px",borderRadius:4,border:"1px solid #10B981",
                            background:"none",color:"#047857",cursor:"pointer"}}
                            onClick={()=>setSelectedSugg(new Set(aiAnalysis.suggestions.map((_:any,i:number)=>i)))}>
                            Selecionar todos
                          </button>
                          <button style={{fontSize:11,padding:"2px 8px",borderRadius:4,border:"1px solid #D1D5DB",
                            background:"none",color:"#6B7280",cursor:"pointer"}}
                            onClick={()=>setSelectedSugg(new Set())}>
                            Desmarcar
                          </button>
                          <span style={{color:"#6B7280"}}>{selectedSugg.size} selecionado(s)</span>
                        </div>
                        <button className="btn btn-primary"
                          disabled={genLoading || selectedSugg.size === 0}
                          onClick={()=>generateSuggestedCases(Array.from(selectedSugg))}
                          style={{background:"#10B981",border:"none",fontWeight:600,
                            fontSize:12,padding:"5px 14px",opacity:selectedSugg.size===0?0.5:1}}>
                          {genLoading ? "⏳ Criando…" : `✨ Criar selecionados (${selectedSugg.size})`}
                        </button>
                      </div>
                    )}
                    {/* Resultado */}
                    {genResult && (
                      <div style={{marginBottom:8,padding:"8px 12px",background:"#DCFCE7",borderRadius:6,
                        border:"1px solid #6EE7B7",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <span style={{fontSize:13,color:"#065F46",fontWeight:600}}>
                          ✅ {genResult.created} caso(s) criado(s){genResult.skipped>0?`, ${genResult.skipped} ignorado(s)`:""}
                        </span>
                        <button style={{fontSize:11,padding:"2px 8px",borderRadius:4,border:"1px solid #10B981",
                          background:"none",color:"#047857",cursor:"pointer"}}
                          onClick={()=>{ setGenResult(null); setSelectedSugg(new Set()); }}>
                          Criar novamente
                        </button>
                      </div>
                    )}
                    {/* Lista com checkboxes */}
                    {aiAnalysis.suggestions.map((s: string, i: number) => (
                      <label key={i} style={{display:"flex",alignItems:"flex-start",gap:8,
                        padding:"7px 10px",background: selectedSugg.has(i)?"#DCFCE7":"#F9FAFB",
                        borderRadius:6,marginBottom:4,borderLeft:`3px solid ${selectedSugg.has(i)?"#10B981":"#D1D5DB"}`,
                        fontSize:12,cursor:"pointer",transition:"background 0.15s"}}>
                        <input type="checkbox" checked={selectedSugg.has(i)} onChange={e=>{
                          const s2 = new Set(selectedSugg);
                          e.target.checked ? s2.add(i) : s2.delete(i);
                          setSelectedSugg(s2);
                        }} style={{marginTop:2,accentColor:"#10B981",flexShrink:0}}/>
                        <span dangerouslySetInnerHTML={{__html: s.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}}/>
                      </label>
                    ))}
                  </>) : aiAnalysis.summary?.total_cases > 0 && aiAnalysis.summary?.total_modules > 0 ? (
                    <div style={{padding:"16px",background:"#F0FDF4",borderRadius:8,border:"1px solid #6EE7B7",textAlign:"center"}}>
                      <div style={{fontSize:28,marginBottom:8}}>🏆</div>
                      <div style={{fontWeight:700,color:"#065F46",fontSize:14}}>Cobertura excelente!</div>
                      <div style={{fontSize:12,color:"#047857",marginTop:4}}>Nenhuma sugestão de melhoria encontrada. Continue assim!</div>
                    </div>
                  ) : null}
                </div>
                )}
              </div>
            ) : (
              <div style={{textAlign:"center",padding:24,color:"var(--text-muted)"}}>Erro ao carregar análise.</div>
            )}
          </div>
          {!aiLoading && (
            <div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}>
              <button className="btn btn-primary" onClick={()=>{ setShowAI(false); setAiAnalysis(null); setGenResult(null); setSelectedSugg(new Set()); }}>Fechar</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}