// Funcoes e helpers compartilhados entre os relatorios de exportacao.
// Extraido de ExportButton.tsx (refatoracao em modulos) - nao altera nenhuma logica.

export interface ExportFilters {
  date_from?: string;
  date_to?: string;
  module_id?: string | number;
  status?: string;
  cycle_id?: string | number;
  period?: string;
}

interface ExportButtonProps {
  style?: CSSProperties;
  filters?: ExportFilters;
}

export function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}
export function getToken() { return localStorage.getItem("qa_token"); }

export async function fetchData(projectId) {
  const res = await fetch(`${getBase()}/export${projectId?`?project_id=${projectId}`:""}`, { headers:{Authorization:`Bearer ${getToken()}`} });
  if (!res.ok) throw new Error(`Servidor indisponível (${res.status}) — aguarde 30s e tente novamente`);
  const json = await res.json();
  const data = json.data ?? json;
  if (!data || !data.testCases) throw new Error("Dados não encontrados — tente novamente");
  return data;
}

export async function fetchDashboard(projectId, filters?) {
  let url = `${getBase()}/dashboard${projectId?`?project_id=${projectId}`:"?"}`;
  if (filters?.date_from) url += `&date_from=${filters.date_from}`;
  if (filters?.date_to)   url += `&date_to=${filters.date_to}`;
  if (filters?.cycle_id)  url += `&cycle_id=${filters.cycle_id}`;
  const res = await fetch(url, { headers:{Authorization:`Bearer ${getToken()}`} });
  if (!res.ok) return {};
  const json = await res.json();
  return json.data ?? json ?? {};
}

// ── Aplica filtros nos dados exportados ───────────────────────
export function applyExportFilters(data, dash, filters) {
  const { date_from, date_to, module_id, status, cycle_id } = filters || {};

  const from = date_from ? new Date(date_from) : null;
  const to   = date_to   ? new Date(date_to+"T23:59:59") : null;
  const filteredCycles = (data.cycles || []).filter(c => {
    if (cycle_id && cycle_id !== "no_cycle") return String(c.id) === String(cycle_id);
    if (cycle_id === "no_cycle") return false;
    const cStart = c.start_date ? new Date(c.start_date + "T12:00:00") : null;
    const cEnd   = c.end_date   ? new Date(c.end_date   + "T12:00:00") : null;
    if (from && cEnd   && cEnd   < from) return false;
    if (to   && cStart && cStart > to)   return false;
    return true;
  });

  const cycleNames = new Set(filteredCycles.map(c => c.name));

  let filteredExec = (data.executions || []).filter(e => {
    if (cycle_id && cycle_id !== "no_cycle" && String(e.cycle_id) !== String(cycle_id) && !cycleNames.has(e.cycle)) return false;
    if (!cycle_id && cycleNames.size > 0 && !cycleNames.has(e.cycle)) return false;
    if (status && e.status !== status) return false;
    if (module_id) {
      const modName = dash.modules?.find(m => String(m.id) === String(module_id))?.name;
      if (modName && e.module !== modName) return false;
    }
    return true;
  });

  const modName = module_id ? dash.modules?.find(m => String(m.id) === String(module_id))?.name : null;
  const filteredTC   = modName ? data.testCases?.filter(tc => tc.module === modName) : data.testCases;
  const filteredMods = modName ? data.modules?.filter(m => m.name === modName) : data.modules;

  const bugIdsInAnyCycle = new Set((data.executions || []).filter(e => e.bug_id).map(e => e.bug_id));
  let filteredBugs = data.bugs || [];
  if (cycle_id === "no_cycle") {
    filteredBugs = filteredBugs.filter(b => !bugIdsInAnyCycle.has(b.id));
  } else if (cycle_id) {
    const bugIdsInCycle = new Set(filteredExec.filter(e => e.bug_id).map(e => e.bug_id));
    filteredBugs = filteredBugs.filter(b => bugIdsInCycle.has(b.id));
  }
  if (!cycle_id) {
    filteredBugs = filteredBugs.filter(b => bugIdsInAnyCycle.has(b.id));
  }
  if (modName) {
    filteredBugs = filteredBugs.filter(b => b.module === modName);
  }

  const moduleMap: Record<string, any> = {};

  filteredExec.forEach(e => {
    if (!e.module) return;
    if (!moduleMap[e.module]) {
      moduleMap[e.module] = { name: e.module, total_cases: 0, total_executions: 0, passed: 0, failed: 0, blocked: 0, not_executed: 0, total_bugs: 0, open_bugs: 0, fixed_bugs: 0 };
    }
    const m = moduleMap[e.module];
    if (e.status === "passed")            { m.passed++;  m.total_executions++; }
    else if (e.status === "failed")       { m.failed++;  m.total_executions++; }
    else if (e.status === "blocked")      { m.blocked++; m.total_executions++; }
    else if (e.status === "not_executed") { m.not_executed++; }
  });

  const noCycleMap: Record<string, any> = {};
  if (cycle_id === "no_cycle") {
    filteredBugs.forEach(b => {
      if (!b.module) return;
      if (!noCycleMap[b.module]) {
        noCycleMap[b.module] = { name: b.module, total_cases: 0, total_bugs: 0, open_bugs: 0, fixed_bugs: 0 };
      }
      noCycleMap[b.module].total_bugs++;
      if (b.status === "open")  noCycleMap[b.module].open_bugs++;
      if (b.status === "fixed") noCycleMap[b.module].fixed_bugs++;
    });
    (data.modules || []).forEach((m: any) => {
      const key = m.name || m.module;
      if (!key) return;
      if (!noCycleMap[key]) {
        noCycleMap[key] = { name: key, total_cases: 0, total_bugs: 0, open_bugs: 0, fixed_bugs: 0 };
      }
      noCycleMap[key].total_cases = parseInt(m.total_cases) || 0;
    });
  }

  (data.modules || []).forEach((m: any) => {
    const key = m.name || m.module;
    if (key && moduleMap[key]) moduleMap[key].total_cases = m.total_cases || 0;
  });

  const recalcMods = Object.values(moduleMap);
  const finalMods = cycle_id === "no_cycle" ? Object.values(noCycleMap) : recalcMods;

  const passed   = filteredExec.filter(e=>e.status==="passed").length;
  const failed   = filteredExec.filter(e=>e.status==="failed").length;
  const blocked  = filteredExec.filter(e=>e.status==="blocked").length;
  const notExec  = filteredExec.filter(e=>e.status==="not_executed").length;
  const total    = filteredExec.length;
  const executed = total - notExec;

  const bugsOpen       = filteredBugs.filter(b=>b.status==="open").length;
  const bugsInProgress = filteredBugs.filter(b=>b.status==="in_progress").length;
  const bugsFixed      = filteredBugs.filter(b=>b.status==="fixed").length;
  const bugsClosed     = filteredBugs.filter(b=>b.status==="closed").length;

  const filteredDash = {
    ...dash,
    summary: {
      ...(dash.summary||{}),
      total_cases:  (filteredTC||[]).length,
      passed, failed, blocked, not_executed: notExec,
      total_executions: executed,
      success_rate: executed>0?+((passed/executed)*100).toFixed(1):0,
      fail_rate:    executed>0?+((failed/executed)*100).toFixed(1):0,
    },
    bugs: {
      open: bugsOpen,
      in_progress: bugsInProgress,
      fixed: bugsFixed,
      closed: bugsClosed,
      total: filteredBugs.length,
    },
    modules: modName ? (dash.modules||[]).filter(m=>m.name===modName) : dash.modules,
  };

  return {
    data: { ...data, cycles: filteredCycles, executions: filteredExec, testCases: filteredTC||[], bugs: filteredBugs||[], modules: recalcMods.length > 0 ? recalcMods : (filteredMods||data.modules||[]) },
    dash: filteredDash,
    finalMods,
  };
}

export function openReport(html: string, fallbackFilename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackFilename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX); s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function hStyle(bg) {
  return { font:{bold:true,color:{rgb:"FFFFFF"},sz:11}, fill:{fgColor:{rgb:bg},patternType:"solid"},
    alignment:{horizontal:"center",vertical:"center",wrapText:true},
    border:{top:{style:"thin",color:{rgb:"CCCCCC"}},bottom:{style:"thin",color:{rgb:"CCCCCC"}},left:{style:"thin",color:{rgb:"CCCCCC"}},right:{style:"thin",color:{rgb:"CCCCCC"}}} };
}
export function cStyle(bg="FFFFFF") {
  return { font:{sz:10}, fill:{fgColor:{rgb:bg},patternType:"solid"}, alignment:{vertical:"top",wrapText:true},
    border:{top:{style:"thin",color:{rgb:"E5E7EB"}},bottom:{style:"thin",color:{rgb:"E5E7EB"}},left:{style:"thin",color:{rgb:"E5E7EB"}},right:{style:"thin",color:{rgb:"E5E7EB"}}} };
}
export const SL={passed:"Passou",failed:"Falhou",blocked:"Bloqueado",not_executed:"Não executado",open:"Aberto",in_progress:"Em andamento",fixed:"Corrigido",closed:"Fechado",active:"Ativo",completed:"Concluído",archived:"Arquivado"};
export const SVL={low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
export const PL={low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
export const fd = d => { try { return d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "—"; } catch { return d || "—"; } };

export const ENV_TRANSLATIONS: Record<string,string> = {
  production: "Produção", prod: "Produção",
  homologation: "Homologação", homolog: "Homologação", staging: "Staging", stage: "Staging",
  development: "Desenvolvimento", dev: "Desenvolvimento",
};
export function envLabel(raw?: string | null) {
  if (!raw || !raw.trim()) return "Não informado";
  const key = raw.trim().toLowerCase();
  return ENV_TRANSLATIONS[key] || raw.trim();
}

export function daysBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return null;
  const d1 = new Date(from.length === 10 ? from + "T12:00:00" : from);
  const d2 = new Date(to.length === 10 ? to + "T12:00:00" : to);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}
export function resolutionDays(bug: any) {
  return daysBetween(bug.created_at, bug.resolved_at);
}

export function applyStyles(ws,headers,rows,bg) {
  const XLSX=window.XLSX;
  ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:headers.length-1}});
  headers.forEach((_,c)=>{ const a=XLSX.utils.encode_cell({r:0,c}); if(ws[a]) ws[a].s=hStyle(bg); });
  rows.forEach((row,ri)=>row.forEach((_,ci)=>{ const a=XLSX.utils.encode_cell({r:ri+1,c:ci}); if(ws[a]) ws[a].s=cStyle(ri%2===0?"FFFFFF":"F9FAFB"); }));
}

export const fmtBR = d => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "";

export function filterLabel(filters) {
  if (!filters || !Object.values(filters).some(Boolean)) return "";
  const parts = [];
  if (filters.date_from || filters.date_to) {
    parts.push(`Período: ${filters.date_from ? fmtBR(filters.date_from) : "início"} → ${filters.date_to ? fmtBR(filters.date_to) : "hoje"}`);
  }
  if (filters.status) parts.push(`Status: ${SL[filters.status]||filters.status}`);
  return parts.length ? `Filtros: ${parts.join(" | ")}` : "";
}
