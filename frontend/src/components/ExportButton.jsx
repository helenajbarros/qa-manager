import { useState } from "react";
import { useProject } from "../context/ProjectContext.jsx";

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload  = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Usa a mesma BASE do api.js
function getBase() {
  return import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";
}

function headerStyle(bgHex) {
  return {
    font:      { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill:      { fgColor: { rgb: bgHex }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top:    { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left:   { style: "thin", color: { rgb: "CCCCCC" } },
      right:  { style: "thin", color: { rgb: "CCCCCC" } },
    },
  };
}

function cellStyle(bgHex = "FFFFFF") {
  return {
    font:      { sz: 10 },
    fill:      { fgColor: { rgb: bgHex }, patternType: "solid" },
    alignment: { vertical: "top", wrapText: true },
    border: {
      top:    { style: "thin", color: { rgb: "E5E7EB" } },
      bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      left:   { style: "thin", color: { rgb: "E5E7EB" } },
      right:  { style: "thin", color: { rgb: "E5E7EB" } },
    },
  };
}

const STATUS_COLORS = { passed:"D1FAE5", failed:"FEE2E2", blocked:"EDE9FE", not_executed:"F3F4F6", open:"FEE2E2", in_progress:"FEF3C7", fixed:"D1FAE5", closed:"F3F4F6", active:"DBEAFE", completed:"D1FAE5", archived:"F3F4F6" };
const SEV_COLORS    = { low:"D1FAE5", medium:"FEF3C7", high:"FEE2E2", critical:"EDE9FE" };
const STATUS_LABELS = { passed:"Passou", failed:"Falhou", blocked:"Bloqueado", not_executed:"Não executado", open:"Aberto", in_progress:"Em andamento", fixed:"Corrigido", closed:"Fechado", active:"Ativo", completed:"Concluído", archived:"Arquivado" };
const SEV_LABELS    = { low:"Baixa", medium:"Média", high:"Alta", critical:"Crítica" };
const PRI_LABELS    = { low:"Baixa", medium:"Média", high:"Alta", critical:"Crítica" };

const fmtDate = d => { try { return d ? new Date(d).toLocaleDateString("pt-BR") : "—"; } catch { return d||"—"; } };

function applyStyles(ws, headers, rows, headerBg) {
  const XLSX  = window.XLSX;
  const range = { s:{r:0,c:0}, e:{r:rows.length, c:headers.length-1} };
  ws["!ref"]  = XLSX.utils.encode_range(range);
  headers.forEach((_,c) => { const a=XLSX.utils.encode_cell({r:0,c}); if(ws[a]) ws[a].s=headerStyle(headerBg); });
  rows.forEach((row,ri) => row.forEach((_,ci) => { const a=XLSX.utils.encode_cell({r:ri+1,c:ci}); if(ws[a]) ws[a].s=cellStyle(ri%2===0?"FFFFFF":"F9FAFB"); }));
}

function buildSummarySheet(data, projectName) {
  const XLSX = window.XLSX;
  const now  = new Date().toLocaleDateString("pt-BR", { dateStyle:"full" });
  const pass = data.executions.filter(e=>e.status==="passed").length;
  const fail = data.executions.filter(e=>e.status==="failed").length;
  const done = data.executions.filter(e=>e.status!=="not_executed").length;
  const sr   = done>0?((pass/done)*100).toFixed(1)+"%" : "0%";
  const fr   = done>0?((fail/done)*100).toFixed(1)+"%" : "0%";

  const rows = [
    ["Projeto", projectName||"—"],
    ["Gerado em", now],
    [""],
    ["RESUMO DE EXECUÇÃO",""],
    ["Total de casos",       data.testCases.length],
    ["Total de execuções",   data.executions.length],
    ["Passou",               pass],
    ["Falhou",               fail],
    ["Bloqueado",            data.executions.filter(e=>e.status==="blocked").length],
    ["Não executado",        data.executions.filter(e=>e.status==="not_executed").length],
    ["Taxa de sucesso",      sr],
    ["Taxa de falha",        fr],
    [""],
    ["RESUMO DE BUGS",""],
    ["Total",                data.bugs.length],
    ["Abertos",              data.bugs.filter(b=>b.status==="open").length],
    ["Em andamento",         data.bugs.filter(b=>b.status==="in_progress").length],
    ["Corrigidos",           data.bugs.filter(b=>b.status==="fixed").length],
    ["Fechados",             data.bugs.filter(b=>b.status==="closed").length],
    [""],
    ["CICLOS",""],
    ...data.cycles.map(c=>[c.name, `${c.passed||0} ✓  ${c.failed||0} ✗  ${c.total||0} total`]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:24},{wch:44}];
  ["A1","A4","A14","A21"].forEach(a => { if(ws[a]) ws[a].s = {font:{bold:true,sz:12}}; });
  return ws;
}

function buildSheet(headers, rows, headerBg, colorFn) {
  const XLSX = window.XLSX;
  const ws   = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyStyles(ws, headers, rows, headerBg);
  if (colorFn) colorFn(ws, rows);
  return ws;
}

async function exportToExcel(projectName, projectId) {
  const token = localStorage.getItem("qa_token");
  const url   = `${getBase()}/export${projectId?`?project_id=${projectId}`:""}`;
  const res   = await fetch(url, { headers: token?{Authorization:`Bearer ${token}`}:{} });
  const json  = await res.json();
  const data  = json.data ?? json;
  const XLSX  = await loadXLSX();
  const wb    = XLSX.utils.book_new();

  // Resumo
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data, projectName), "Resumo");

  // Casos de teste
  const tcHeaders = ["ID","Módulo","Título","Prioridade","Responsável","Pré-condições","Passos","Resultado esperado","Criado em"];
  const tcRows    = data.testCases.map(tc=>[tc.id, tc.module||"—", tc.title, PRI_LABELS[tc.priority]||tc.priority, tc.assigned_to||"—", tc.preconditions||"—", tc.steps||"—", tc.expected_result||"—", fmtDate(tc.created_at)]);
  const tcWs      = buildSheet(tcHeaders, tcRows, "2563EB", (ws,rows) => {
    rows.forEach((r,ri) => { const a=XLSX.utils.encode_cell({r:ri+1,c:3}); if(ws[a]) ws[a].s={...cellStyle(SEV_COLORS[data.testCases[ri].priority]||"FFFFFF"),font:{sz:10,bold:true}}; });
  });
  tcWs["!cols"] = [{wch:6},{wch:16},{wch:36},{wch:10},{wch:18},{wch:28},{wch:36},{wch:28},{wch:12}];
  XLSX.utils.book_append_sheet(wb, tcWs, "Casos de Teste");

  // Ciclos
  const cyHeaders = ["Ciclo","Versão","Status","Início","Fim","Tipos","Total","Passou","Falhou","Bloqueado","Não exec","% Sucesso"];
  const cyRows    = data.cycles.map(c=>{
    const done=(c.total||0)-(c.not_executed||0);
    const pct=done>0?((c.passed/done)*100).toFixed(1)+"%":"—";
    return [c.name, c.version||"—", STATUS_LABELS[c.status]||c.status, fmtDate(c.start_date), fmtDate(c.end_date), c.test_types?c.test_types.split(",").join(", "):"—", c.total||0, c.passed||0, c.failed||0, c.blocked||0, c.not_executed||0, pct];
  });
  const cyWs = buildSheet(cyHeaders, cyRows, "7C3AED", (ws,rows)=>{
    rows.forEach((r,ri)=>{ const a=XLSX.utils.encode_cell({r:ri+1,c:2}); if(ws[a]) ws[a].s={...cellStyle(STATUS_COLORS[data.cycles[ri].status]||"FFFFFF"),font:{sz:10,bold:true}}; });
  });
  cyWs["!cols"] = [{wch:24},{wch:10},{wch:12},{wch:12},{wch:12},{wch:28},{wch:8},{wch:8},{wch:8},{wch:10},{wch:10},{wch:10}];
  XLSX.utils.book_append_sheet(wb, cyWs, "Ciclos");

  // Execuções
  const exHeaders = ["Ciclo","TC #","Caso de teste","Módulo","Status","Executado por","Responsável","Comentário","URL Evidência","Bug vinculado","Executado em"];
  const exRows    = data.executions.map(e=>[e.cycle, e.tc_id, e.test_case, e.module||"—", STATUS_LABELS[e.status]||e.status, e.executed_by||"—", e.assigned_to||"—", e.comment||"—", e.evidence_url||"—", e.bug_id?`#${e.bug_id} ${e.bug_title}`:"—", fmtDate(e.executed_at)]);
  const exWs = buildSheet(exHeaders, exRows, "059669", (ws,rows)=>{
    rows.forEach((r,ri)=>{ const a=XLSX.utils.encode_cell({r:ri+1,c:4}); if(ws[a]) ws[a].s={...cellStyle(STATUS_COLORS[data.executions[ri].status]||"FFFFFF"),font:{sz:10,bold:true}}; });
  });
  exWs["!cols"] = [{wch:20},{wch:6},{wch:32},{wch:16},{wch:14},{wch:18},{wch:18},{wch:30},{wch:30},{wch:24},{wch:14}];
  XLSX.utils.book_append_sheet(wb, exWs, "Execuções");

  // Bugs
  const bgHeaders = ["#","Título","Módulo","TC","Severidade","Status","Criado por","Comentário","Tracker","Criado em"];
  const bgRows    = data.bugs.map(b=>[b.id, b.title, b.module||"—", b.tc_id?`#${b.tc_id}`:"—", SEV_LABELS[b.severity]||b.severity, STATUS_LABELS[b.status]||b.status, b.created_by||"—", b.comment||"—", b.tracker_url||"—", fmtDate(b.created_at)]);
  const bgWs = buildSheet(bgHeaders, bgRows, "DC2626", (ws,rows)=>{
    rows.forEach((r,ri)=>{
      const sa=XLSX.utils.encode_cell({r:ri+1,c:4}); if(ws[sa]) ws[sa].s={...cellStyle(SEV_COLORS[data.bugs[ri].severity]||"FFFFFF"),font:{sz:10,bold:true}};
      const sta=XLSX.utils.encode_cell({r:ri+1,c:5}); if(ws[sta]) ws[sta].s={...cellStyle(STATUS_COLORS[data.bugs[ri].status]||"FFFFFF"),font:{sz:10,bold:true}};
    });
  });
  bgWs["!cols"] = [{wch:6},{wch:36},{wch:16},{wch:10},{wch:10},{wch:14},{wch:18},{wch:30},{wch:30},{wch:12}];
  XLSX.utils.book_append_sheet(wb, bgWs, "Bugs");

  // Módulos
  const mdHeaders = ["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Total bugs","Bugs abertos","% Sucesso"];
  const mdRows    = data.modules.map(m=>{
    const done=(m.total_executions||0)-(m.not_executed||0);
    const pct=done>0?((m.passed/done)*100).toFixed(1)+"%":"—";
    return [m.module, m.total_cases||0, m.total_executions||0, m.passed||0, m.failed||0, m.blocked||0, m.total_bugs||0, m.open_bugs||0, pct];
  });
  const mdWs = buildSheet(mdHeaders, mdRows, "D97706");
  mdWs["!cols"] = [{wch:20},{wch:8},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:10}];
  XLSX.utils.book_append_sheet(wb, mdWs, "Módulos");

  const date     = new Date().toLocaleDateString("pt-BR").replace(/\//g,"-");
  const filename = `QA_Report_${(projectName||"Export").replace(/\s+/g,"_")}_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function ExportButton({ style }) {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleExport() {
    setLoading(true); setError("");
    try { await exportToExcel(currentProject?.name, currentProject?.id); }
    catch(e) { console.error(e); setError("Erro ao exportar. Tente novamente."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{display:"inline-flex",flexDirection:"column",gap:4}}>
      <button className="btn" onClick={handleExport} disabled={loading} style={style}>
        {loading ? "⏳ Gerando…" : "⬇ Exportar Planilha"}
      </button>
      {error && <span style={{fontSize:11,color:"var(--danger)"}}>{error}</span>}
    </div>
  );
}
