import { useState } from "react";
import { useProject } from "../context/ProjectContext.jsx";

// SheetJS loaded from CDN via dynamic import equivalent
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

// ── Styling helpers ──────────────────────────────────────────

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

const STATUS_COLORS = {
  passed:       "D1FAE5",
  failed:       "FEE2E2",
  blocked:      "EDE9FE",
  not_executed: "F3F4F6",
  open:         "FEE2E2",
  in_progress:  "FEF3C7",
  fixed:        "D1FAE5",
  closed:       "F3F4F6",
  active:       "DBEAFE",
  completed:    "D1FAE5",
  archived:     "F3F4F6",
};

const SEV_COLORS = {
  low:      "D1FAE5",
  medium:   "FEF3C7",
  high:     "FEE2E2",
  critical: "EDE9FE",
};

const STATUS_LABELS = {
  passed:"Passou", failed:"Falhou", blocked:"Bloqueado", not_executed:"Não executado",
  open:"Aberto", in_progress:"Em andamento", fixed:"Corrigido", closed:"Fechado",
  active:"Ativo", completed:"Concluído", archived:"Arquivado",
};
const SEV_LABELS = { low:"Baixa", medium:"Média", high:"Alta", critical:"Crítica" };
const PRI_LABELS = { low:"Baixa", medium:"Média", high:"Alta", critical:"Crítica" };

function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function applyStyles(ws, headers, rows, headerBg) {
  const range = { s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } };
  ws["!ref"] = window.XLSX.utils.encode_range(range);

  headers.forEach((_, c) => {
    const addr = window.XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = headerStyle(headerBg);
  });

  rows.forEach((row, ri) => {
    row.forEach((_, ci) => {
      const addr = window.XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (ws[addr]) ws[addr].s = cellStyle(ri % 2 === 0 ? "FFFFFF" : "F9FAFB");
    });
  });
}

function setColWidths(ws, widths) {
  ws["!cols"] = widths.map(w => ({ wch: w }));
}

// ── Sheet builders ────────────────────────────────────────────

function buildSummarySheet(data, projectName) {
  const XLSX = window.XLSX;
  const now  = new Date().toLocaleDateString("pt-BR", { dateStyle: "full" });

  const totalExec   = data.executions.length;
  const passed      = data.executions.filter(e => e.status === "passed").length;
  const failed      = data.executions.filter(e => e.status === "failed").length;
  const blocked     = data.executions.filter(e => e.status === "blocked").length;
  const notExec     = data.executions.filter(e => e.status === "not_executed").length;
  const execDone    = totalExec - notExec;
  const successRate = execDone > 0 ? ((passed / execDone) * 100).toFixed(1) : "0.0";
  const failRate    = execDone > 0 ? ((failed / execDone) * 100).toFixed(1) : "0.0";

  const rows = [
    ["Projeto",          projectName || "—"],
    ["Gerado em",        now],
    [""],
    ["RESUMO DE EXECUÇÃO", ""],
    ["Total de casos",   data.testCases.length],
    ["Total de execuções", totalExec],
    ["Passou",           passed],
    ["Falhou",           failed],
    ["Bloqueado",        blocked],
    ["Não executado",    notExec],
    ["Taxa de sucesso",  `${successRate}%`],
    ["Taxa de falha",    `${failRate}%`],
    [""],
    ["RESUMO DE BUGS", ""],
    ["Total de bugs",    data.bugs.length],
    ["Abertos",          data.bugs.filter(b => b.status === "open").length],
    ["Em andamento",     data.bugs.filter(b => b.status === "in_progress").length],
    ["Corrigidos",       data.bugs.filter(b => b.status === "fixed").length],
    ["Fechados",         data.bugs.filter(b => b.status === "closed").length],
    [""],
    ["CICLOS", ""],
    ...data.cycles.map(c => [
      c.name,
      `${c.passed||0} passou / ${c.failed||0} falhou / ${c.total||0} total`,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 24 }, { wch: 40 }];

  // Title style
  ["A1","A4","A14","A21"].forEach(addr => {
    if (ws[addr]) ws[addr].s = { font: { bold: true, sz: 12 } };
  });

  return ws;
}

function buildTestCasesSheet(testCases) {
  const XLSX    = window.XLSX;
  const headers = ["ID","Módulo","Título","Prioridade","Responsável","Pré-condições","Passos","Resultado esperado","Criado em"];
  const rows    = testCases.map(tc => [
    tc.id,
    tc.module        || "—",
    tc.title,
    PRI_LABELS[tc.priority] || tc.priority,
    tc.assigned_to   || "—",
    tc.preconditions || "—",
    tc.steps         || "—",
    tc.expected_result || "—",
    fmtDate(tc.created_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyStyles(ws, headers, rows, "2563EB");
  setColWidths(ws, [6, 16, 36, 10, 18, 28, 36, 28, 12]);

  // Color priority column
  rows.forEach((row, ri) => {
    const addr = XLSX.utils.encode_cell({ r: ri + 1, c: 3 });
    const pri  = testCases[ri].priority;
    if (ws[addr]) ws[addr].s = { ...cellStyle(SEV_COLORS[pri] || "FFFFFF"), font: { sz: 10, bold: true } };
  });

  return ws;
}

function buildCyclesSheet(cycles) {
  const XLSX    = window.XLSX;
  const headers = ["Ciclo","Versão","Status","Início","Fim","Tipos de teste","Total","Passou","Falhou","Bloqueado","Não exec.","% Sucesso"];
  const rows    = cycles.map(c => {
    const total = c.total || 0;
    const done  = total - (c.not_executed || 0);
    const pct   = done > 0 ? ((c.passed / done) * 100).toFixed(1) + "%" : "—";
    return [
      c.name,
      c.version || "—",
      STATUS_LABELS[c.status] || c.status,
      fmtDate(c.start_date),
      fmtDate(c.end_date),
      c.test_types ? c.test_types.split(",").join(", ") : "—",
      total,
      c.passed      || 0,
      c.failed      || 0,
      c.blocked     || 0,
      c.not_executed|| 0,
      pct,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyStyles(ws, headers, rows, "7C3AED");
  setColWidths(ws, [24, 10, 12, 12, 12, 28, 8, 8, 8, 10, 10, 10]);

  // Color status col
  rows.forEach((row, ri) => {
    const addr = XLSX.utils.encode_cell({ r: ri + 1, c: 2 });
    if (ws[addr]) ws[addr].s = { ...cellStyle(STATUS_COLORS[cycles[ri].status] || "FFFFFF"), font:{sz:10,bold:true} };
  });

  return ws;
}

function buildExecutionsSheet(executions) {
  const XLSX    = window.XLSX;
  const headers = ["Ciclo","Versão","TC #","Caso de teste","Módulo","Status","Executado por","Responsável","Comentário","Evidência URL","Bug vinculado","Executado em"];
  const rows    = executions.map(e => [
    e.cycle,
    e.version    || "—",
    e.tc_id,
    e.test_case,
    e.module     || "—",
    STATUS_LABELS[e.status] || e.status,
    e.executed_by|| "—",
    e.assigned_to|| "—",
    e.comment    || "—",
    e.evidence_url || "—",
    e.bug_id ? `#${e.bug_id} ${e.bug_title}` : "—",
    fmtDate(e.executed_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyStyles(ws, headers, rows, "059669");
  setColWidths(ws, [20, 10, 6, 32, 16, 14, 18, 18, 30, 30, 24, 14]);

  // Color status col
  rows.forEach((row, ri) => {
    const addr = XLSX.utils.encode_cell({ r: ri + 1, c: 5 });
    if (ws[addr]) ws[addr].s = { ...cellStyle(STATUS_COLORS[executions[ri].status] || "FFFFFF"), font:{sz:10,bold:true} };
  });

  return ws;
}

function buildBugsSheet(bugs) {
  const XLSX    = window.XLSX;
  const headers = ["#","Título","Módulo","TC vinculado","Severidade","Status","Criado por","Comentário","Tracker URL","Criado em"];
  const rows    = bugs.map(b => [
    b.id,
    b.title,
    b.module     || "—",
    b.tc_id ? `#${b.tc_id} ${b.test_case}` : "—",
    SEV_LABELS[b.severity]     || b.severity,
    STATUS_LABELS[b.status]    || b.status,
    b.created_by || "—",
    b.comment    || "—",
    b.tracker_url|| "—",
    fmtDate(b.created_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyStyles(ws, headers, rows, "DC2626");
  setColWidths(ws, [6, 36, 16, 24, 10, 14, 18, 30, 30, 12]);

  // Color severity + status
  rows.forEach((row, ri) => {
    const sevAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 4 });
    const stAddr  = XLSX.utils.encode_cell({ r: ri + 1, c: 5 });
    if (ws[sevAddr]) ws[sevAddr].s = { ...cellStyle(SEV_COLORS[bugs[ri].severity]    || "FFFFFF"), font:{sz:10,bold:true} };
    if (ws[stAddr])  ws[stAddr].s  = { ...cellStyle(STATUS_COLORS[bugs[ri].status]   || "FFFFFF"), font:{sz:10,bold:true} };
  });

  return ws;
}

function buildModulesSheet(modules) {
  const XLSX    = window.XLSX;
  const headers = ["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Total bugs","Bugs abertos","% Sucesso"];
  const rows    = modules.map(m => {
    const done = m.total_executions - (m.not_executed || 0);
    const pct  = done > 0 ? ((m.passed / done) * 100).toFixed(1) + "%" : "—";
    return [
      m.module, m.total_cases, m.total_executions,
      m.passed || 0, m.failed || 0, m.blocked || 0,
      m.total_bugs || 0, m.open_bugs || 0, pct,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyStyles(ws, headers, rows, "D97706");
  setColWidths(ws, [20, 8, 12, 8, 8, 10, 10, 12, 10]);
  return ws;
}

// ── Main export function ──────────────────────────────────────

async function exportToExcel(projectName, projectId) {
  const token = localStorage.getItem("qa_token");
  const url   = `/api/export${projectId ? `?project_id=${projectId}` : ""}`;
  const res   = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const json  = await res.json();
  const data  = json.data ?? json;

  const XLSX  = await loadXLSX();
  const wb    = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data, projectName),    "📊 Resumo");
  XLSX.utils.book_append_sheet(wb, buildTestCasesSheet(data.testCases),     "📋 Casos de Teste");
  XLSX.utils.book_append_sheet(wb, buildCyclesSheet(data.cycles),           "🔁 Ciclos");
  XLSX.utils.book_append_sheet(wb, buildExecutionsSheet(data.executions),   "▶ Execuções");
  XLSX.utils.book_append_sheet(wb, buildBugsSheet(data.bugs),               "🐛 Bugs");
  XLSX.utils.book_append_sheet(wb, buildModulesSheet(data.modules),         "🗂 Módulos");

  const date     = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const filename = `QA_Report_${(projectName||"Export").replace(/\s+/g,"_")}_${date}.xlsx`;

  XLSX.writeFile(wb, filename);
}

// ── Component ─────────────────────────────────────────────────

export function ExportButton({ style }) {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleExport() {
    setLoading(true); setError("");
    try {
      await exportToExcel(currentProject?.name, currentProject?.id);
    } catch(e) {
      console.error(e);
      setError("Erro ao exportar. Tente novamente.");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button className="btn" onClick={handleExport} disabled={loading} style={style}>
        {loading ? "⏳ Gerando…" : "⬇ Exportar Planilha"}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
