import { useState, CSSProperties } from "react";
import { useProject } from "../context/ProjectContext.js";

interface ExportFilters {
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

function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}
function getToken() { return localStorage.getItem("qa_token"); }

async function fetchData(projectId) {
  const res = await fetch(`${getBase()}/export${projectId?`?project_id=${projectId}`:""}`, { headers:{Authorization:`Bearer ${getToken()}`} });
  if (!res.ok) throw new Error(`Servidor indisponível (${res.status}) — aguarde 30s e tente novamente`);
  const json = await res.json();
  const data = json.data ?? json;
  if (!data || !data.testCases) throw new Error("Dados não encontrados — tente novamente");
  return data;
}

async function fetchDashboard(projectId, filters?) {
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
function applyExportFilters(data, dash, filters) {
  const { date_from, date_to, module_id, status, cycle_id } = filters || {};

  // Filtra ciclos por período ou ciclo específico
  const from = date_from ? new Date(date_from) : null;
  const to   = date_to   ? new Date(date_to+"T23:59:59") : null;
  const filteredCycles = (data.cycles || []).filter(c => {
    if (cycle_id && cycle_id !== "no_cycle") return String(c.id) === String(cycle_id);
    if (cycle_id === "no_cycle") return false; // no_cycle não filtra por ciclo
    const cStart = c.start_date ? new Date(c.start_date + "T12:00:00") : null;
    const cEnd   = c.end_date   ? new Date(c.end_date   + "T12:00:00") : null;
    if (from && cEnd   && cEnd   < from) return false;
    if (to   && cStart && cStart > to)   return false;
    return true;
  });

  // Nomes dos ciclos filtrados
  const cycleNames = new Set(filteredCycles.map(c => c.name));

  // Filtra execuções: por ciclo + status + módulo
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

  // Filtra módulo pelo nome
  const modName = module_id ? dash.modules?.find(m => String(m.id) === String(module_id))?.name : null;
  const filteredTC   = modName ? data.testCases?.filter(tc => tc.module === modName) : data.testCases;
  const filteredMods = modName ? data.modules?.filter(m => m.name === modName) : data.modules;

  // Filtra bugs conforme o tipo de filtro:
  // - no_cycle: só bugs exploratórios (sem vínculo com nenhuma execução)
  // - cycle_id específico: só bugs vinculados às execuções desse ciclo
  // - sem filtro: todos os bugs do projeto
  const bugIdsInAnyCycle = new Set((data.executions || []).filter(e => e.bug_id).map(e => e.bug_id));
  let filteredBugs = data.bugs || [];
  if (cycle_id === "no_cycle") {
    filteredBugs = filteredBugs.filter(b => !bugIdsInAnyCycle.has(b.id));
  } else if (cycle_id) {
    const bugIdsInCycle = new Set(filteredExec.filter(e => e.bug_id).map(e => e.bug_id));
    filteredBugs = filteredBugs.filter(b => bugIdsInCycle.has(b.id));
  }
  // sem filtro: só bugs vinculados a algum ciclo (excluir exploratórios)
  if (!cycle_id) {
    filteredBugs = filteredBugs.filter(b => bugIdsInAnyCycle.has(b.id));
  }
  if (modName) {
    filteredBugs = filteredBugs.filter(b => b.module === modName);
  }

  // Recalcula módulos a partir das execuções E bugs filtrados
  const moduleMap: Record<string, any> = {};

  // Popula moduleMap a partir das execuções
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

  // finalMods para no_cycle: construído a partir dos bugs exploratórios
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
    // Adiciona TODOS os módulos ao noCycleMap (mesmo sem bugs)
    // para que total_cases apareça corretamente no relatório
    (data.modules || []).forEach((m: any) => {
      const key = m.name || m.module;
      if (!key) return;
      if (!noCycleMap[key]) {
        noCycleMap[key] = { name: key, total_cases: 0, total_bugs: 0, open_bugs: 0, fixed_bugs: 0 };
      }
      noCycleMap[key].total_cases = parseInt(m.total_cases) || 0;
    });
  }

  // total_cases vem dos dados originais de módulo
  (data.modules || []).forEach((m: any) => {
    const key = m.name || m.module;
    if (key && moduleMap[key]) moduleMap[key].total_cases = m.total_cases || 0;
  });

  const recalcMods = Object.values(moduleMap);
  const finalMods = cycle_id === "no_cycle" ? Object.values(noCycleMap) : recalcMods;

  // Recalcula summary a partir das execuções filtradas
  const passed   = filteredExec.filter(e=>e.status==="passed").length;
  const failed   = filteredExec.filter(e=>e.status==="failed").length;
  const blocked  = filteredExec.filter(e=>e.status==="blocked").length;
  const notExec  = filteredExec.filter(e=>e.status==="not_executed").length;
  const total    = filteredExec.length;
  const executed = total - notExec;

  // Recalcula bugs a partir dos bugs filtrados
  const bugsOpen       = filteredBugs.filter(b=>b.status==="open").length;
  const bugsInProgress = filteredBugs.filter(b=>b.status==="in_progress").length;
  const bugsFixed      = filteredBugs.filter(b=>b.status==="fixed").length;
  const bugsClosed     = filteredBugs.filter(b=>b.status==="closed").length;

  const filteredDash = {
    ...dash,
    summary: {
      ...(dash.summary||{}),
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
    finalMods, // só usado no modo no_cycle
  };
}

// ── XLSX ──────────────────────────────────────────────────────
async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX); s.onerror = reject;
    document.head.appendChild(s);
  });
}

function hStyle(bg) {
  return { font:{bold:true,color:{rgb:"FFFFFF"},sz:11}, fill:{fgColor:{rgb:bg},patternType:"solid"},
    alignment:{horizontal:"center",vertical:"center",wrapText:true},
    border:{top:{style:"thin",color:{rgb:"CCCCCC"}},bottom:{style:"thin",color:{rgb:"CCCCCC"}},left:{style:"thin",color:{rgb:"CCCCCC"}},right:{style:"thin",color:{rgb:"CCCCCC"}}} };
}
function cStyle(bg="FFFFFF") {
  return { font:{sz:10}, fill:{fgColor:{rgb:bg},patternType:"solid"}, alignment:{vertical:"top",wrapText:true},
    border:{top:{style:"thin",color:{rgb:"E5E7EB"}},bottom:{style:"thin",color:{rgb:"E5E7EB"}},left:{style:"thin",color:{rgb:"E5E7EB"}},right:{style:"thin",color:{rgb:"E5E7EB"}}} };
}
const SL={passed:"Passou",failed:"Falhou",blocked:"Bloqueado",not_executed:"Não executado",open:"Aberto",in_progress:"Em andamento",fixed:"Corrigido",closed:"Fechado",active:"Ativo",completed:"Concluído",archived:"Arquivado"};
const SVL={low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
const PL={low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
const fd = d => { try { return d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "—"; } catch { return d || "—"; } };

function applyStyles(ws,headers,rows,bg) {
  const XLSX=window.XLSX;
  ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:headers.length-1}});
  headers.forEach((_,c)=>{ const a=XLSX.utils.encode_cell({r:0,c}); if(ws[a]) ws[a].s=hStyle(bg); });
  rows.forEach((row,ri)=>row.forEach((_,ci)=>{ const a=XLSX.utils.encode_cell({r:ri+1,c:ci}); if(ws[a]) ws[a].s=cStyle(ri%2===0?"FFFFFF":"F9FAFB"); }));
}

const fmtBR = d => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "";

function filterLabel(filters) {
  if (!filters || !Object.values(filters).some(Boolean)) return "";
  const parts = [];
  if (filters.date_from || filters.date_to) {
    parts.push(`Período: ${filters.date_from ? fmtBR(filters.date_from) : "início"} → ${filters.date_to ? fmtBR(filters.date_to) : "hoje"}`);
  }
  if (filters.status) parts.push(`Status: ${SL[filters.status]||filters.status}`);
  return parts.length ? `Filtros: ${parts.join(" | ")}` : "";
}

async function exportExcel(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const { data, finalMods = [] } = applyExportFilters(rawData, rawDash, filters);

  const XLSX = await loadXLSX();
  const wb   = XLSX.utils.book_new();
  const now  = new Date().toLocaleDateString("pt-BR",{dateStyle:"full"});
  const fLabel = filterLabel(filters);

  const pass=data.executions.filter(e=>e.status==="passed").length;
  const fail=data.executions.filter(e=>e.status==="failed").length;
  const done=data.executions.filter(e=>e.status!=="not_executed").length;
  const sr=done>0?((pass/done)*100).toFixed(1)+"%":"0%";
  const fr=done>0?((fail/done)*100).toFixed(1)+"%":"0%";

  const sumRows=[
    ["Projeto",projectName||"—"],["Gerado em",now],
    ...(fLabel ? [["Filtros aplicados", fLabel], [""]] : [[""]]),
    ["RESUMO DE EXECUÇÃO",""],
    ["Total de casos",data.testCases.length],["Total executado",done],
    ["Passou",pass],["Falhou",fail],
    ["Bloqueado",data.executions.filter(e=>e.status==="blocked").length],
    ["Não executado",data.executions.filter(e=>e.status==="not_executed").length],
    ["Taxa de sucesso",sr],["Taxa de falha",fr],[""],
    ["RESUMO DE BUGS",""],["Total",data.bugs.length],
    ["Abertos",data.bugs.filter(b=>b.status==="open").length],
    ["Em andamento",data.bugs.filter(b=>b.status==="in_progress").length],
    ["Corrigidos",data.bugs.filter(b=>b.status==="fixed").length],
    ["Fechados",data.bugs.filter(b=>b.status==="closed").length],[""],
    ["BUGS POR AMBIENTE",""],
    ...["production","homologation","staging","development"].map(env => {
      const envBugs = data.bugs.filter(b=>(b.environment||"development")===env);
      const label = env==="production"?"Produção":env==="homologation"?"Homologação":env==="staging"?"Staging":"Desenvolvimento";
      return [label, envBugs.length, `${envBugs.filter(b=>b.status==="open").length} abertos`];
    }).filter(r=>r[1]>0),[""],

  ];
  const sumWs=XLSX.utils.aoa_to_sheet(sumRows);
  sumWs["!cols"]=[{wch:24},{wch:44}];
  XLSX.utils.book_append_sheet(wb,sumWs,"Resumo");

  const tcH=["ID","Módulo","Título","Prioridade","Responsável","Pré-condições","Passos","Resultado esperado","Criado em"];
  // Aba Casos de Teste removida do relatório

  // Aba Ciclos removida do relatório

  // Aba Execuções removida do relatório

  const bgH=["#","Título","Módulo","TC","Severidade","Status","Criado por","Comentário","Tracker","Criado em"];
  const bgR=data.bugs.map(b=>[b.id,b.title,b.module||"—",b.tc_id?`#${b.tc_id}`:"—",SVL[b.severity]||b.severity,SL[b.status]||b.status,b.created_by||"—",b.comment||"—",b.tracker_url||"—",fd(b.created_at)]);
  const bgWs=XLSX.utils.aoa_to_sheet([bgH,...bgR]);
  applyStyles(bgWs,bgH,bgR,"DC2626");
  bgWs["!cols"]=[{wch:6},{wch:36},{wch:16},{wch:10},{wch:10},{wch:14},{wch:18},{wch:30},{wch:30},{wch:12}];
  XLSX.utils.book_append_sheet(wb,bgWs,"Bugs");

  const mdH=["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Total bugs","Bugs abertos","% Sucesso"];
  const mdR=data.modules.map(m=>{ const d2=Math.max(0,(m.total_executions||0)-(m.not_executed||0)); const pct=d2>0?((m.passed/d2)*100).toFixed(1)+"%":"—"; return [m.module||m.name,m.total_cases||0,d2,m.passed||0,m.failed||0,m.blocked||0,m.total_bugs||0,m.open_bugs||0,pct]; });
  const mdWs=XLSX.utils.aoa_to_sheet([mdH,...mdR]);
  applyStyles(mdWs,mdH,mdR,"D97706");
  mdWs["!cols"]=[{wch:20},{wch:8},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:10}];
  XLSX.utils.book_append_sheet(wb,mdWs,"Módulos");

  const date=new Date().toLocaleDateString("pt-BR").replace(/\//g,"-");
  XLSX.writeFile(wb,`QA_Report_${(projectName||"Export").replace(/\s+/g,"_")}_${date}.xlsx`);
}

// ── HTML com gráficos ─────────────────────────────────────────
async function exportHTML(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const { data, dash, finalMods = [] } = applyExportFilters(rawData, rawDash, filters);
  const isNoCycle = (filters?.cycle_id === "no_cycle");

  const now  = new Date().toLocaleString("pt-BR");
  const s    = dash.summary || {};
  const fLabel = filterLabel(filters);

  const execPie = [
    { label:"Passou",        value: s.passed||0,        color:"#10B981" },
    { label:"Falhou",        value: s.failed||0,        color:"#EF4444" },
    { label:"Bloqueado",     value: s.blocked||0,       color:"#8B5CF6" },
    { label:"Não executado", value: s.not_executed||0,  color:"#9CA3AF" },
  ].filter(d=>d.value>0);

  const bugPie = [
    { label:"Aberto",       value: dash.bugs?.open||0,        color:"#EF4444" },
    { label:"Em andamento", value: dash.bugs?.in_progress||0, color:"#F59E0B" },
    { label:"Corrigido",    value: dash.bugs?.fixed||0,       color:"#10B981" },
    { label:"Fechado",      value: dash.bugs?.closed||0,      color:"#9CA3AF" },
  ].filter(d=>d.value>0);

  // effectiveNoCycle só é true quando explicitamente filtrado por "no_cycle"
  const effectiveNoCycle = isNoCycle;
  const modData = (effectiveNoCycle ? finalMods : (data.modules||dash.modules||[])).slice(0,10);

  function pieChart(items, title) {
    const total = items.reduce((a,b)=>a+b.value,0);
    if (!total) return `<div class="chart-box"><h3>${title}</h3><p style="color:#999;text-align:center">Sem dados</p></div>`;
    let svgPaths="", legends="";
    // Caso especial: 1 item = 100% — arco de 360graus e invalido em SVG, usar circulo
    if (items.length === 1) {
      svgPaths = `<circle cx="100" cy="100" r="80" fill="${items[0].color}"/>`;
      legends  = `<div class="legend-item"><span class="legend-dot" style="background:${items[0].color}"></span>${items[0].label}: <b>${items[0].value}</b> (100.0%)</div>`;
    } else {
      let angleDeg=-90;
      items.forEach(item => {
        const pct=item.value/total;
        const a1=angleDeg*Math.PI/180;
        angleDeg+=pct*360;
        const a2=angleDeg*Math.PI/180;
        const x1=100+80*Math.cos(a1), y1=100+80*Math.sin(a1);
        const x2=100+80*Math.cos(a2), y2=100+80*Math.sin(a2);
        svgPaths+=`<path d="M100,100 L${x1.toFixed(2)},${y1.toFixed(2)} A80,80 0 ${pct>.5?1:0},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${item.color}" fill-opacity="1" stroke="white" stroke-width="2"/>`;
        legends +=`<div class="legend-item"><span class="legend-dot" style="background:${item.color}"></span>${item.label}: <b>${item.value}</b> (${(pct*100).toFixed(1)}%)</div>`;
      });
    }
    // width/height fixos em px garantem renderizacao correta no print engine do browser
    return `<div class="chart-box"><h3>${title}</h3><div class="pie-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="180" height="180" style="display:block;width:180px;height:180px;flex-shrink:0">${svgPaths}</svg><div class="legends">${legends}</div></div></div>`;
  }

  function barChart(items, title) {
    if (!items.length) return `<div class="chart-box wide"><h3>${title}</h3><p style="color:#999">Sem dados</p></div>`;
    if (effectiveNoCycle) {
      // Bugs sem ciclo: mostra bugs abertos/corrigidos por módulo
      const bars = items.filter(m => (m.total_bugs||0) > 0).map(m => {
        const tot = m.total_bugs||1;
        const open = m.open_bugs||0;
        const fixed = m.fixed_bugs||0;
        const other = Math.max(0, tot - open - fixed);
        return `<div class="bar-row"><div class="bar-label">${m.name}</div><div class="bar-track">
          <div class="bar-seg" style="width:${(open/tot*100).toFixed(1)}%;background:#EF4444" title="Abertos: ${open}"></div>
          <div class="bar-seg" style="width:${(fixed/tot*100).toFixed(1)}%;background:#10B981" title="Corrigidos: ${fixed}"></div>
          <div class="bar-seg" style="width:${(other/tot*100).toFixed(1)}%;background:#9CA3AF" title="Outros: ${other}"></div>
        </div><div class="bar-nums">${open} abertos</div></div>`;
      }).join("");
      return `<div class="chart-box wide"><h3>${title}</h3><div class="bar-legend"><span style="background:#EF4444"></span>Abertos <span style="background:#10B981"></span>Corrigidos <span style="background:#9CA3AF"></span>Outros</div>${bars||'<p style="color:#999">Sem bugs</p>'}</div>`;
    }
    const bars=items.filter(m=>(m.passed||0)+(m.failed||0)+(m.blocked||0)+(m.not_executed||0)>0).map(m=>{ const p=m.passed||0,f=m.failed||0,bl=m.blocked||0,ne=m.not_executed||0,tot=p+f+bl+ne||1;
      const label=(m.module||m.name||"—"); return `<div class="bar-row"><div class="bar-label">${label}</div><div class="bar-track">
        <div class="bar-seg" style="width:${(p/tot*100).toFixed(1)}%;background:#10B981" title="Passou: ${p}"></div>
        <div class="bar-seg" style="width:${(f/tot*100).toFixed(1)}%;background:#EF4444" title="Falhou: ${f}"></div>
        <div class="bar-seg" style="width:${(bl/tot*100).toFixed(1)}%;background:#8B5CF6" title="Bloqueado: ${bl}"></div>
        <div class="bar-seg" style="width:${(ne/tot*100).toFixed(1)}%;background:#E5E7EB" title="Não exec: ${ne}"></div>
      </div><div class="bar-nums">${p}✓ ${f}✗</div></div>`;
    }).join("");
    return `<div class="chart-box wide"><h3>${title}</h3><div class="bar-legend"><span style="background:#10B981"></span>Passou <span style="background:#EF4444"></span>Falhou <span style="background:#8B5CF6"></span>Bloqueado <span style="background:#E5E7EB;border:1px solid #ccc"></span>Não exec</div>${bars}</div>`;
  }

  function trendChart(cycles) {
    if (!cycles || cycles.length < 2) return "";
    const sorted = [...cycles]
      .filter(c => (c.total||0) > 0)
      .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-10);
    if (sorted.length < 2) return "";

    const W = 600, H = 200, padL = 40, padR = 20, padT = 20, padB = 50;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const step = chartW / (sorted.length - 1);

    const points = sorted.map((c, i) => {
      const exec = (c.total||0) - (c.not_executed||0);
      const succ = exec > 0 ? +((c.passed/exec)*100).toFixed(1) : 0;
      const fail = exec > 0 ? +((c.failed/exec)*100).toFixed(1) : 0;
      const x = padL + i * step;
      const ySucc = padT + chartH - (succ/100)*chartH;
      const yFail = padT + chartH - (fail/100)*chartH;
      const date = c.start_date ? c.start_date.slice(0,10).split("-").reverse().slice(0,2).join("/") : "";
      const name = (c.name||"").length > 10 ? (c.name||"").slice(0,10)+"…" : (c.name||"");
      return { x, ySucc, yFail, succ, fail, label: `${i+1}º ${name}${date?" ("+date+")":""}` };
    });

    const succLine = points.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.ySucc.toFixed(1)}`).join(" ");
    const failLine = points.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.yFail.toFixed(1)}`).join(" ");

    // Y axis labels
    const yLabels = [0,25,50,75,100].map(v => {
      const y = padT + chartH - (v/100)*chartH;
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/>
              <text x="${padL-4}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="10" fill="#94A3B8">${v}%</text>`;
    }).join("");

    // X axis labels
    const xLabels = points.map(p =>
      `<text x="${p.x.toFixed(1)}" y="${(padT+chartH+16).toFixed(1)}" text-anchor="middle" font-size="9" fill="#64748B">${p.label}</text>`
    ).join("");

    // Dots and value labels
    const succDots = points.map(p =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.ySucc.toFixed(1)}" r="4" fill="#10B981"/>
       <text x="${p.x.toFixed(1)}" y="${(p.ySucc-8).toFixed(1)}" text-anchor="middle" font-size="10" fill="#10B981" font-weight="bold">${p.succ}%</text>`
    ).join("");
    const failDots = points.map(p =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.yFail.toFixed(1)}" r="4" fill="#EF4444"/>
       <text x="${p.x.toFixed(1)}" y="${(p.yFail+16).toFixed(1)}" text-anchor="middle" font-size="10" fill="#EF4444" font-weight="bold">${p.fail}%</text>`
    ).join("");

    return `<div class="chart-box wide">
      <h3>Tendência de qualidade por ciclo</h3>
      <div style="font-size:11px;color:#94A3B8;margin-bottom:8px">Taxa de sucesso e falha nos últimos ${sorted.length} ciclos executados</div>
      <div style="display:flex;gap:16px;margin-bottom:8px;font-size:12px">
        <span><span style="display:inline-block;width:12px;height:3px;background:#10B981;vertical-align:middle;margin-right:4px"></span>Sucesso</span>
        <span><span style="display:inline-block;width:12px;height:3px;background:#EF4444;vertical-align:middle;margin-right:4px"></span>Falha</span>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;width:100%;max-width:${W}px">
        ${yLabels}
        <path d="${succLine}" fill="none" stroke="#10B981" stroke-width="2.5"/>
        <path d="${failLine}" fill="none" stroke="#EF4444" stroke-width="2.5"/>
        ${succDots}
        ${failDots}
        ${xLabels}
      </svg>
    </div>`;
  }

  function table(headers, rows) {
    const ths=headers.map(h=>`<th>${h}</th>`).join("");
    const trs=rows.map((r,i)=>`<tr class="${i%2?"even":""}">${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório QA — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#1E3A5F,#2563EB);color:white;padding:32px 40px;}
  .header h1{font-size:28px;margin-bottom:6px;}
  .header p{opacity:.8;font-size:14px;}
  .filter-badge{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 16px;margin:0 40px 0;font-size:13px;color:#1E40AF;}
  .container{max-width:1200px;margin:0 auto;padding:32px 24px;}
  h2{font-size:20px;color:#1E3A5F;margin:32px 0 16px;border-bottom:3px solid #2563EB;padding-bottom:8px;break-after:avoid;page-break-after:avoid;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px;}
  .card{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .card .val{font-size:32px;font-weight:700;margin:8px 0;}
  .card .lbl{font-size:12px;color:#64748B;}
  .green{color:#10B981;}.red{color:#EF4444;}.purple{color:#8B5CF6;}.blue{color:#2563EB;}
  .charts{display:flex;flex-wrap:wrap;gap:24px;margin-bottom:32px;}
  .chart-box{background:white;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08);min-width:280px;}
  .chart-box.wide{flex:1;min-width:100%;}
  .chart-box h3{font-size:16px;color:#1E3A5F;margin-bottom:16px;}
  .pie-wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
  .legends{display:flex;flex-direction:column;gap:8px;}
  .legend-item{font-size:13px;display:flex;align-items:center;gap:8px;}
  .legend-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
  .bar-legend{display:flex;gap:16px;font-size:12px;color:#64748B;margin-bottom:12px;align-items:center;}
  .bar-legend span{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:4px;}
  .bar-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .bar-label{width:140px;font-size:13px;text-align:right;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .bar-track{flex:1;height:20px;background:#F1F5F9;border-radius:4px;display:flex;overflow:hidden;}
  .bar-seg{height:100%;}
  .bar-nums{width:60px;font-size:12px;color:#64748B;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:13px;margin-bottom:24px;}
  thead tr{background:#1E3A5F;color:white;}
  th,td{padding:10px 14px;text-align:left;}
  tr.even td{background:#F8FAFC;}
  tbody tr:hover td{background:#EFF6FF;}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
  .badge-passed,.badge-completed{background:#D1FAE5;color:#065F46;}
  .badge-fixed{background:#D1FAE5;color:#065F46;}
  .badge-failed{background:#FEE2E2;color:#991B1B;}
  .badge-open{background:#FEE2E2;color:#991B1B;}
  .badge-blocked,.badge-critical{background:#EDE9FE;color:#5B21B6;}
  .badge-not_executed,.badge-closed,.badge-archived{background:#F3F4F6;color:#374151;}
  .badge-in_progress,.badge-active{background:#FEF3C7;color:#92400E;}
  .badge-medium{background:#FEF3C7;color:#92400E;}
  .badge-high{background:#FEE2E2;color:#991B1B;}
  .badge-low{background:#F3F4F6;color:#374151;}
  .footer{text-align:center;padding:32px;color:#94A3B8;font-size:12px;}
  .no-print{}
  @media print{
    .no-print{display:none!important}
    body{background:white}
    .card,.chart-box{box-shadow:none;border:1px solid #E2E8F0;break-inside:avoid;}
    .charts{display:flex!important;flex-wrap:wrap!important;}
    .chart-box{page-break-inside:avoid;}
    .pie-wrap{display:flex!important;align-items:center!important;}
    svg{display:block!important;visibility:visible!important;overflow:visible!important;}
    svg path,svg circle{display:block!important;visibility:visible!important;fill-opacity:1!important;}
    h2{break-before:auto;break-after:avoid;page-break-after:avoid;}
    h2 + table, h2 + div{break-before:avoid;page-break-before:avoid;}
    table{break-inside:avoid;}
  }
</style>
</head>
<body>
<div class="header">
  <h1>📊 Relatório QA — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now}</p>
</div>
${fLabel?`<div class="filter-badge">🔍 ${fLabel}</div>`:""}
<div class="container">
  <h2>Resumo Geral</h2>
  <div class="cards">
    <div class="card"><div class="val blue">${s.total_cases||0}</div><div class="lbl">Casos cadastrados</div></div>
    <div class="card"><div class="val">${s.total_executions||0}</div><div class="lbl">Total executado</div></div>
    <div class="card"><div class="val green">${s.success_rate||0}%</div><div class="lbl">Taxa de sucesso</div></div>
    <div class="card"><div class="val red">${s.fail_rate||0}%</div><div class="lbl">Taxa de falha</div></div>
    <div class="card"><div class="val purple">${s.blocked||0}</div><div class="lbl">Bloqueados</div></div>
    <div class="card"><div class="val red">${dash.bugs?.open||0}</div><div class="lbl">Bugs abertos</div></div>
  </div>
  <h2>Gráficos</h2>
  <div class="charts">
    ${effectiveNoCycle ? "" : pieChart(execPie,"Execuções por Status")}
    ${pieChart(bugPie,"Bugs por Status")}
    ${barChart(modData,"Resultados por Módulo")}
    ${trendChart(data.cycles)}
  </div>


  ${(()=>{
    const envMap = {"production":"Produção","homologation":"Homologação","staging":"Staging","development":"Desenvolvimento"};
    const envColors = {"production":"#EF4444","homologation":"#F59E0B","staging":"#8B5CF6","development":"#2563EB"};
    const envData = ["production","homologation","staging","development"].map(env=>{
      const envBugs = data.bugs.filter(b=>(b.environment||"development")===env);
      return {env, label:envMap[env], total:envBugs.length, open:envBugs.filter(b=>b.status==="open").length};
    }).filter(e=>e.total>0);
    if(!envData.length) return "";
    return `<h2>Bugs por Ambiente</h2><div class="cards">${envData.map(e=>`
      <div class="card"><div class="val" style="color:${envColors[e.env]}">${e.total}</div>
      <div class="lbl">${e.label}</div>
      <div style="font-size:11px;color:#EF4444;margin-top:4px">${e.open} aberto${e.open!==1?"s":""}</div></div>`).join("")}</div>`;
  })()}
  ${data.bugs.length > 0 ? `<h2>Bugs</h2>
  ${table(["#","Título","Módulo","Severidade","Status","Criado por","Tracker"],
    data.bugs.map(b=>[b.id,b.title,b.module||"—","<span class=\"badge badge-"+b.severity+"\">"+( SVL[b.severity]||b.severity)+"</span>","<span class=\"badge badge-"+b.status+"\">"+( SL[b.status]||b.status)+"</span>",b.created_by||"—",b.tracker_url?"<a href=\""+b.tracker_url+"\" target=\"_blank\">Ver</a>":"—"]))}`  : ""}
  ${effectiveNoCycle ? (finalMods.filter(m=>(m.total_bugs||0)>0).length > 0 ? `<h2>Bugs por Módulo</h2>
  ${table(["Módulo","Casos","Total Bugs","Abertos","Corrigidos"],
    finalMods.filter(m=>(m.total_bugs||0)>0).map(m=>[m.name,m.total_cases||0,m.total_bugs||0,"<span class=\"red\">"+(m.open_bugs||0)+"</span>","<span class=\"green\">"+(m.fixed_bugs||0)+"</span>"]))}` : "") :
  ((data.modules||[]).length > 0 ? `<h2>Métricas por Módulo</h2>
  ${table(["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Bugs","% Sucesso"],
    (data.modules||[]).map(m=>{const d2=(m.total_executions||0)-(m.not_executed||0);const pct=d2>0?((m.passed/d2)*100).toFixed(1)+"%":"—";const exec2=Math.max(0,(m.total_executions||0)-(m.not_executed||0)); const mname=m.module||m.name||'—'; return[mname,m.total_cases||0,exec2,"<span class=\"green\">"+( m.passed||0)+"</span>","<span class=\"red\">"+( m.failed||0)+"</span>",m.blocked||0,m.total_bugs||0,pct];}))}` : "")}
</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#1E3A5F;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
  <p style="margin-top:8px;color:#94A3B8;font-size:12px">Dica: na janela de impressão selecione "Salvar como PDF" para gerar o arquivo</p>
</div>
<div class="footer">QA Manager — Relatório gerado em ${now} | ${projectName||"Projeto"}${fLabel?` | ${fLabel}`:""}</div>
</body>
</html>`;

  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`QA_Relatorio_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Relatório Executivo ──────────────────────────────────────
async function exportExecutive(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const { data, dash, finalMods = [] } = applyExportFilters(rawData, rawDash, filters);
  const isNoCycle = (filters?.cycle_id === "no_cycle");
  const s = dash.summary || {};
  const now = new Date().toLocaleString("pt-BR");
  const fLabel = filterLabel(filters);

  const executed = s.total_executions || 0;
  const passed = s.passed || 0;
  const failed = s.failed || 0;
  const blocked = s.blocked || 0;
  const notExec = s.not_executed || 0;
  const totalCases = s.total_cases || 0;
  const successRate = s.success_rate || 0;
  const failRate = s.fail_rate || 0;
  const coverage = totalCases > 0 ? +((executed / totalCases) * 100).toFixed(1) : 0;
  const openBugs = dash.bugs?.open || 0;
  const totalBugs = dash.bugs?.total || 0;
  const criticalBugs = data.bugs.filter(b => b.severity === "critical" && b.status === "open").length;
  const highBugs = data.bugs.filter(b => b.severity === "high" && b.status === "open").length;

  // Índice de qualidade (0-100)
  const qualityScore = executed > 0
    ? Math.round(successRate * 0.5 + (100 - failRate) * 0.3 + Math.min(coverage, 100) * 0.2)
    : Math.round(Math.min(coverage, 100) * 0.5);

  const scoreColor = qualityScore >= 80 ? "#10B981" : qualityScore >= 60 ? "#F59E0B" : "#EF4444";
  const scoreLabel = qualityScore >= 80 ? "BOM" : qualityScore >= 60 ? "ATENÇÃO" : "CRÍTICO";

  // Risco
  const risk = criticalBugs > 0 || (failRate > 30 && executed > 0) ? "ALTO" :
               highBugs > 0 || (failRate > 10 && executed > 0) ? "MÉDIO" : "BAIXO";
  const riskColor = risk === "ALTO" ? "#EF4444" : risk === "MÉDIO" ? "#F59E0B" : "#10B981";

  // Recomendação
  const rec = criticalBugs > 0 ? "❌ NÃO RECOMENDADO para produção — existem bugs críticos abertos." :
              highBugs > 0 ? "⚠️ RECOMENDADO com ressalvas — resolver bugs de alta severidade antes do deploy." :
              failRate > 20 ? "⚠️ ATENÇÃO — taxa de falha elevada. Revisar módulos com mais falhas." :
              coverage < 50 ? "⚠️ Cobertura baixa — aumentar execução de casos de teste." :
              successRate >= 80 ? "✅ APROVADO — produto em condição satisfatória para entrega." :
              "ℹ️ Em progresso — aguardar conclusão do ciclo de testes.";

  // Top módulos com falha — usa data.modules filtrado pelo ciclo
  const modsSource = data.modules || rawData.modules || [];
  const modsFailed = modsSource
    .filter(m => (m.failed || 0) > 0)
    .sort((a,b) => (b.failed||0) - (a.failed||0))
    .slice(0, 5);

  // Bugs críticos/altos abertos
  const urgentBugs = data.bugs
    .filter(b => ["critical","high"].includes(b.severity) && b.status === "open")
    .slice(0, 10);

  const SVL: Record<string,string> = {low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Executivo — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header{background:linear-gradient(135deg,#1E3A5F,#2563EB);color:white;padding:32px 40px}
  .header h1{font-size:24px;margin-bottom:4px}
  .header p{opacity:.8;font-size:13px}
  .container{max-width:960px;margin:0 auto;padding:32px 24px}
  .section{margin-bottom:28px}
  .section-title{font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E2E8F0}
  .card{background:white;border-radius:12px;padding:20px 24px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:12px}
  .score-card{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
  .score-circle{width:90px;height:90px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
  .score-num{font-size:28px;font-weight:800;line-height:1}
  .score-lbl{font-size:10px;font-weight:700;letter-spacing:.05em;margin-top:2px}
  .metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
  .metric{text-align:center;padding:16px 12px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0}
  .metric-val{font-size:26px;font-weight:700;margin-bottom:4px}
  .metric-lbl{font-size:11px;color:#64748B}
  .rec-box{padding:14px 18px;border-radius:8px;font-size:14px;font-weight:500;border-left:4px solid}
  .risk-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#F1F5F9;padding:8px 12px;text-align:left;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.05em}
  td{padding:8px 12px;border-bottom:1px solid #F1F5F9}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
  .badge-critical{background:#FEE2E2;color:#7F1D1D}
  .badge-high{background:#FEE2E2;color:#991B1B}
  .footer{text-align:center;padding:24px;color:#94A3B8;font-size:12px}
  .no-print{}
  @media print{.no-print{display:none!important}body{background:white}.card{box-shadow:none;border:1px solid #E2E8F0}}
</style>
</head>
<body>
<div class="header">
  <h1>📋 Relatório Executivo — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now}${fLabel ? ` &nbsp;|&nbsp; ${fLabel}` : ""}</p>
</div>
<div class="container">

  <!-- Índice de Qualidade + Recomendação -->
  <div class="section">
    <div class="section-title">Avaliação Geral</div>
    <div class="card score-card">
      <div class="score-circle" style="background:${scoreColor}20;border:3px solid ${scoreColor}">
        <div class="score-num" style="color:${scoreColor}">${qualityScore}</div>
        <div class="score-lbl" style="color:${scoreColor}">${scoreLabel}</div>
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
          <span style="font-size:15px;font-weight:600">Índice de Qualidade</span>
          <span class="risk-badge" style="background:${riskColor}20;color:${riskColor}">⚠ Risco ${risk}</span>
        </div>
        <div class="rec-box" style="background:${scoreColor}10;border-color:${scoreColor};color:${scoreColor === "#10B981" ? "#065F46" : scoreColor === "#F59E0B" ? "#92400E" : "#7F1D1D"}">${rec}</div>
      </div>
    </div>
  </div>

  <!-- Métricas principais -->
  <div class="section">
    <div class="section-title">Métricas do Ciclo</div>
    <div class="metrics-grid">
      <div class="metric"><div class="metric-val" style="color:#2563EB">${totalCases}</div><div class="metric-lbl">Casos Cadastrados</div></div>
      <div class="metric"><div class="metric-val">${executed}</div><div class="metric-lbl">Executados</div></div>
      <div class="metric"><div class="metric-val" style="color:#10B981">${successRate}%</div><div class="metric-lbl">Taxa de Sucesso</div></div>
      <div class="metric"><div class="metric-val" style="color:#EF4444">${failRate}%</div><div class="metric-lbl">Taxa de Falha</div></div>
      <div class="metric"><div class="metric-val" style="color:#6366F1">${coverage}%</div><div class="metric-lbl">Cobertura</div></div>
      <div class="metric"><div class="metric-val" style="color:${openBugs > 0 ? "#EF4444" : "#10B981"}">${openBugs}</div><div class="metric-lbl">Bugs Abertos</div></div>
    </div>
  </div>

  <!-- Bugs críticos -->
  ${urgentBugs.length > 0 ? `
  <div class="section">
    <div class="section-title">⚠ Bugs Críticos e Altos Abertos</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th>#</th><th>Título</th><th>Módulo</th><th>Severidade</th></tr></thead>
        <tbody>
          ${urgentBugs.map(b => `<tr>
            <td style="color:#64748B">${b.id}</td>
            <td style="font-weight:500">${b.title}</td>
            <td>${b.module||"—"}</td>
            <td><span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>` : ""}

  <!-- Módulos com falha -->
  ${modsFailed.length > 0 ? `
  <div class="section">
    <div class="section-title">Módulos com Maior Índice de Falha</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th>Módulo</th><th>Casos</th><th>Passou</th><th>Falhou</th><th>% Sucesso</th></tr></thead>
        <tbody>
          ${modsFailed.map(m => {
            const exec2 = Math.max(0,(m.total_executions||0)-(m.not_executed||0));
            const pct2 = exec2>0?((m.passed/exec2)*100).toFixed(1)+"%":"—";
            return `<tr>
              <td style="font-weight:500">${m.module||m.name}</td>
              <td>${m.total_cases||0}</td>
              <td style="color:#10B981">${m.passed||0}</td>
              <td style="color:#EF4444">${m.failed||0}</td>
              <td>${pct2}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>` : ""}

  <!-- Cobertura por módulo -->
  <div class="section">
    <div class="section-title">Cobertura por Módulo</div>
    <div class="card">
      ${(rawData.modules||data.modules||[]).filter(m=>(m.total_cases||0)>0).map(m => {
        const modExec = (data.modules||[]).find(dm=>(dm.module||dm.name)===(m.module||m.name));
        const exec2 = Math.max(0,(modExec?.total_executions||0)-(modExec?.not_executed||0));
        const cov2 = (m.total_cases||0)>0?Math.round((exec2/(m.total_cases||1))*100):0;
        const col = cov2>=80?"#10B981":cov2>=50?"#F59E0B":"#EF4444";
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
            <span>${m.module||m.name}</span>
            <span style="color:${col};font-weight:600">${cov2}%</span>
          </div>
          <div style="background:#F1F5F9;border-radius:4px;height:8px">
            <div style="width:${cov2}%;background:${col};border-radius:4px;height:8px"></div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>

</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#1E3A5F;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="footer">Relatório Executivo — ${projectName||"Projeto"} — ${now}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Relatorio_Executivo_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Relatório de Defeitos ─────────────────────────────────────
async function exportBugReport(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const { data } = applyExportFilters(rawData, rawDash, filters);
  const now = new Date().toLocaleString("pt-BR");
  const fLabel = filterLabel(filters);
  const bugs = [...(data.bugs || [])].sort((a,b) => {
    const order = { critical:0, high:1, medium:2, low:3 };
    const so = (order[a.severity]??9) - (order[b.severity]??9);
    if (so !== 0) return so;
    return new Date(b.created_at||0) - new Date(a.created_at||0);
  });

  const bySeverity = { critical:0, high:0, medium:0, low:0 };
  const byStatus   = { open:0, in_progress:0, fixed:0, closed:0 };
  const byEnv      = { production:0, homologation:0, staging:0, development:0 };
  const byModule: Record<string, any>   = {};
  bugs.forEach(b => {
    if (b.severity in bySeverity) bySeverity[b.severity]++;
    if (b.status   in byStatus)   byStatus[b.status]++;
    const env = b.environment || "development";
    byEnv[env] = (byEnv[env]||0) + 1;
    const mod = b.module || "—";
    if (!byModule[mod]) byModule[mod] = { total:0, open:0, fixed:0 };
    byModule[mod].total++;
    if (b.status === "open") byModule[mod].open++;
    if (b.status === "fixed") byModule[mod].fixed++;
  });

  const sevPie = [
    { label:"Crítica", value: bySeverity.critical, color:"#DC2626" },
    { label:"Alta",    value: bySeverity.high,     color:"#EF4444" },
    { label:"Média",   value: bySeverity.medium,   color:"#F59E0B" },
    { label:"Baixa",   value: bySeverity.low,      color:"#9CA3AF" },
  ].filter(d => d.value > 0);

  const statPie = [
    { label:"Aberto",       value: byStatus.open,        color:"#EF4444" },
    { label:"Em andamento", value: byStatus.in_progress, color:"#F59E0B" },
    { label:"Corrigido",    value: byStatus.fixed,       color:"#10B981" },
    { label:"Fechado",      value: byStatus.closed,      color:"#9CA3AF" },
  ].filter(d => d.value > 0);

  const envLabels = { production:"Produção", homologation:"Homologação", staging:"Staging", development:"Desenvolvimento" };
  const envColors = { production:"#EF4444", homologation:"#F59E0B", staging:"#8B5CF6", development:"#2563EB" };

  function pieChart(items, title) {
    const total = items.reduce((a,b)=>a+b.value,0);
    if (!total) return `<div class="chart-box"><h3>${title}</h3><p style="color:#999;text-align:center">Sem dados</p></div>`;
    let svgPaths="", legends="";
    if (items.length === 1) {
      svgPaths = `<circle cx="100" cy="100" r="80" fill="${items[0].color}"/>`;
      legends  = `<div class="legend-item"><span class="legend-dot" style="background:${items[0].color}"></span>${items[0].label}: <b>${items[0].value}</b> (100.0%)</div>`;
    } else {
      let angleDeg=-90;
      items.forEach(item => {
        const pct=item.value/total;
        const a1=angleDeg*Math.PI/180;
        angleDeg+=pct*360;
        const a2=angleDeg*Math.PI/180;
        const x1=100+80*Math.cos(a1), y1=100+80*Math.sin(a1);
        const x2=100+80*Math.cos(a2), y2=100+80*Math.sin(a2);
        svgPaths+=`<path d="M100,100 L${x1.toFixed(2)},${y1.toFixed(2)} A80,80 0 ${pct>.5?1:0},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${item.color}" fill-opacity="1" stroke="white" stroke-width="2"/>`;
        legends +=`<div class="legend-item"><span class="legend-dot" style="background:${item.color}"></span>${item.label}: <b>${item.value}</b> (${(pct*100).toFixed(1)}%)</div>`;
      });
    }
    return `<div class="chart-box"><h3>${title}</h3><div class="pie-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="180" height="180" style="display:block;width:180px;height:180px;flex-shrink:0">${svgPaths}</svg><div class="legends">${legends}</div></div></div>`;
  }

  function table(headers, rows) {
    const ths = headers.map(h=>`<th>${h}</th>`).join("");
    const trs = rows.map((r,i)=>`<tr class="${i%2?"even":""}">${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  const moduleRows = Object.entries(byModule)
    .sort((a,b) => b[1].total - a[1].total)
    .map(([name, m]) => [name, m.total, `<span class="red">${m.open}</span>`, `<span class="green">${m.fixed}</span>`]);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório de Defeitos — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#7C2D12,#DC2626);color:white;padding:32px 40px;}
  .header h1{font-size:26px;margin-bottom:6px;}
  .header p{opacity:.85;font-size:14px;}
  .filter-badge{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 16px;margin:16px 40px 0;font-size:13px;color:#991B1B;}
  .container{max-width:1200px;margin:0 auto;padding:32px 24px;}
  h2{font-size:20px;color:#7C2D12;margin:32px 0 16px;border-bottom:3px solid #DC2626;padding-bottom:8px;break-after:avoid;page-break-after:avoid;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:32px;}
  .card{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .card .val{font-size:30px;font-weight:700;margin:8px 0;}
  .card .lbl{font-size:12px;color:#64748B;}
  .green{color:#10B981;}.red{color:#EF4444;}.purple{color:#8B5CF6;}.blue{color:#2563EB;}
  .charts{display:flex;flex-wrap:wrap;gap:24px;margin-bottom:32px;}
  .chart-box{background:white;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08);min-width:280px;}
  .chart-box.wide{flex:1;min-width:100%;}
  .chart-box h3{font-size:16px;color:#7C2D12;margin-bottom:16px;}
  .pie-wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
  .legends{display:flex;flex-direction:column;gap:8px;}
  .legend-item{font-size:13px;display:flex;align-items:center;gap:8px;}
  .legend-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:13px;margin-bottom:24px;}
  thead tr{background:#7C2D12;color:white;}
  th,td{padding:10px 14px;text-align:left;}
  tr.even td{background:#F8FAFC;}
  tbody tr:hover td{background:#FEF2F2;}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
  .badge-fixed,.badge-passed{background:#D1FAE5;color:#065F46;}
  .badge-open,.badge-failed{background:#FEE2E2;color:#991B1B;}
  .badge-critical{background:#FEE2E2;color:#7F1D1D;}
  .badge-high{background:#FEE2E2;color:#991B1B;}
  .badge-medium,.badge-in_progress{background:#FEF3C7;color:#92400E;}
  .badge-low,.badge-closed{background:#F3F4F6;color:#374151;}
  .desc-cell{max-width:280px;font-size:12px;color:#475569;}
  .footer{text-align:center;padding:32px;color:#94A3B8;font-size:12px;}
  .no-print{}
  @media print{
    .no-print{display:none!important}
    body{background:white}
    .card,.chart-box{box-shadow:none;border:1px solid #E2E8F0;break-inside:avoid;}
    .charts{display:flex!important;flex-wrap:wrap!important;}
    .chart-box{page-break-inside:avoid;}
    .pie-wrap{display:flex!important;align-items:center!important;}
    svg{display:block!important;visibility:visible!important;overflow:visible!important;}
    svg path,svg circle{display:block!important;visibility:visible!important;fill-opacity:1!important;}
    h2{break-before:auto;break-after:avoid;page-break-after:avoid;}
    table{break-inside:avoid;}
  }
</style>
</head>
<body>
<div class="header">
  <h1>🐛 Relatório de Defeitos — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now}</p>
</div>
${fLabel?`<div class="filter-badge">🔍 ${fLabel}</div>`:""}
<div class="container">
  <h2>Resumo de Defeitos</h2>
  <div class="cards">
    <div class="card"><div class="val blue">${bugs.length}</div><div class="lbl">Total de bugs</div></div>
    <div class="card"><div class="val red">${byStatus.open}</div><div class="lbl">Abertos</div></div>
    <div class="card"><div class="val" style="color:#F59E0B">${byStatus.in_progress}</div><div class="lbl">Em andamento</div></div>
    <div class="card"><div class="val green">${byStatus.fixed}</div><div class="lbl">Corrigidos</div></div>
    <div class="card"><div class="val">${byStatus.closed}</div><div class="lbl">Fechados</div></div>
    <div class="card"><div class="val" style="color:#DC2626">${bySeverity.critical}</div><div class="lbl">Críticos</div></div>
  </div>

  <h2>Gráficos</h2>
  <div class="charts">
    ${pieChart(sevPie,"Bugs por Severidade")}
    ${pieChart(statPie,"Bugs por Status")}
  </div>

  ${Object.values(byEnv).some(v=>v>0) ? `<h2>Bugs por Ambiente</h2><div class="cards">${
    Object.entries(byEnv).filter(([,v])=>v>0).map(([env,total]) => `
      <div class="card"><div class="val" style="color:${envColors[env]}">${total}</div>
      <div class="lbl">${envLabels[env]}</div></div>`).join("")
  }</div>` : ""}

  ${moduleRows.length ? `<h2>Bugs por Módulo</h2>${table(["Módulo","Total","Abertos","Corrigidos"], moduleRows)}` : ""}

  <h2>Detalhamento dos Bugs</h2>
  ${bugs.length ? table(
    ["#","Título","Módulo","TC","Severidade","Status","Ambiente","Descrição","Criado por","Criado em","Tracker"],
    bugs.map(b => [
      b.id,
      b.title,
      b.module||"—",
      b.tc_id?`#${b.tc_id}`:"—",
      `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`,
      `<span class="badge badge-${b.status}">${SL[b.status]||b.status}</span>`,
      envLabels[b.environment||"development"],
      `<span class="desc-cell">${b.description||b.comment||"—"}</span>`,
      b.created_by||"—",
      fd(b.created_at),
      b.tracker_url?`<a href="${b.tracker_url}" target="_blank">Ver</a>`:"—",
    ])
  ) : `<p style="color:#999">Nenhum bug encontrado para os filtros aplicados.</p>`}
</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#7C2D12;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
  <p style="margin-top:8px;color:#94A3B8;font-size:12px">Dica: na janela de impressão selecione "Salvar como PDF" para gerar o arquivo</p>
</div>
<div class="footer">QA Manager — Relatório de Defeitos gerado em ${now} | ${projectName||"Projeto"}${fLabel?` | ${fLabel}`:""}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Relatorio_Defeitos_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Release Notes de QA ──────────────────────────────────────
async function exportReleaseNotes(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const { data, dash } = applyExportFilters(rawData, rawDash, filters);
  const now = new Date().toLocaleString("pt-BR");
  const fLabel = filterLabel(filters);
  const s = dash.summary || {};

  const bugs = data.bugs || [];
  const fixedBugs = bugs.filter(b => b.status === "fixed" || b.status === "closed")
    .sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  const knownIssues = bugs.filter(b => b.status === "open" || b.status === "in_progress")
    .sort((a,b) => {
      const order = { critical:0, high:1, medium:2, low:3 };
      return (order[a.severity]??9) - (order[b.severity]??9);
    });

  const executed = s.total_executions || 0;
  const totalCases = s.total_cases || 0;
  const successRate = s.success_rate || 0;
  const coverage = totalCases > 0 ? +((executed / totalCases) * 100).toFixed(1) : 0;
  const criticalOpen = knownIssues.filter(b => b.severity === "critical").length;
  const highOpen = knownIssues.filter(b => b.severity === "high").length;

  // Versão: usa a versão do ciclo mais recente com dados, se disponível
  const cyclesWithVersion = (data.cycles||[]).filter(c => c.version);
  const version = cyclesWithVersion.length
    ? [...cyclesWithVersion].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0].version
    : null;

  const status = criticalOpen > 0 ? { label:"❌ Não recomendado para release", color:"#EF4444",
      text:"Existem defeitos críticos em aberto que impedem o lançamento desta versão." } :
    highOpen > 0 ? { label:"⚠️ Release com ressalvas", color:"#F59E0B",
      text:"Existem defeitos de alta severidade em aberto. Avaliar impacto antes do lançamento." } :
    successRate >= 80 ? { label:"✅ Pronto para release", color:"#10B981",
      text:"Nenhum bloqueio identificado. Qualidade validada para lançamento." } :
    { label:"ℹ️ Validação em andamento", color:"#2563EB",
      text:"Ciclo de testes ainda em progresso. Acompanhar conclusão antes do lançamento." };

  const modulesTested = (data.modules||[]).filter(m => (m.total_cases||0) > 0);

  function table(headers, rows) {
    const ths = headers.map(h=>`<th>${h}</th>`).join("");
    const trs = rows.map((r,i)=>`<tr class="${i%2?"even":""}">${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Release Notes de QA — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header{background:linear-gradient(135deg,#1E3A5F,#2563EB);color:white;padding:32px 40px}
  .header h1{font-size:24px;margin-bottom:4px}
  .header p{opacity:.85;font-size:13px}
  .container{max-width:960px;margin:0 auto;padding:32px 24px}
  .section{margin-bottom:28px}
  .section-title{font-size:13px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E2E8F0}
  .card{background:white;border-radius:12px;padding:20px 24px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:12px}
  .status-box{padding:16px 20px;border-radius:8px;border-left:4px solid;display:flex;flex-direction:column;gap:4px}
  .status-box .label{font-size:16px;font-weight:700}
  .status-box .text{font-size:13px;color:#475569}
  .metrics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
  .metric{text-align:center;padding:16px 12px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0}
  .metric-val{font-size:26px;font-weight:700;margin-bottom:4px}
  .metric-lbl{font-size:11px;color:#64748B}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#F1F5F9;padding:8px 12px;text-align:left;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.05em}
  td{padding:8px 12px;border-bottom:1px solid #F1F5F9}
  tr.even td{background:#FAFBFC}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
  .badge-critical{background:#FEE2E2;color:#7F1D1D}
  .badge-high{background:#FEE2E2;color:#991B1B}
  .badge-medium{background:#FEF3C7;color:#92400E}
  .badge-low{background:#F3F4F6;color:#374151}
  .footer{text-align:center;padding:24px;color:#94A3B8;font-size:12px}
  .no-print{}
  @media print{.no-print{display:none!important}body{background:white}.card{box-shadow:none;border:1px solid #E2E8F0}table{break-inside:avoid}}
</style>
</head>
<body>
<div class="header">
  <h1>📋 Release Notes de QA — ${projectName||"Projeto"}${version?` (v${version})`:""}</h1>
  <p>Gerado em ${now}${fLabel ? ` &nbsp;|&nbsp; ${fLabel}` : ""}</p>
</div>
<div class="container">

  <div class="section">
    <div class="section-title">Status de Release</div>
    <div class="card status-box" style="border-color:${status.color}">
      <span class="label" style="color:${status.color}">${status.label}</span>
      <span class="text">${status.text}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Resumo da Validação</div>
    <div class="metrics-grid">
      <div class="metric"><div class="metric-val" style="color:#2563EB">${totalCases}</div><div class="metric-lbl">Casos Testados</div></div>
      <div class="metric"><div class="metric-val">${executed}</div><div class="metric-lbl">Execuções</div></div>
      <div class="metric"><div class="metric-val" style="color:#10B981">${successRate}%</div><div class="metric-lbl">Taxa de Sucesso</div></div>
      <div class="metric"><div class="metric-val" style="color:#6366F1">${coverage}%</div><div class="metric-lbl">Cobertura</div></div>
      <div class="metric"><div class="metric-val" style="color:#10B981">${fixedBugs.length}</div><div class="metric-lbl">Corrigidos</div></div>
      <div class="metric"><div class="metric-val" style="color:${knownIssues.length>0?"#EF4444":"#10B981"}">${knownIssues.length}</div><div class="metric-lbl">Problemas Conhecidos</div></div>
    </div>
  </div>

  ${fixedBugs.length ? `
  <div class="section">
    <div class="section-title">✅ Correções Incluídas Nesta Versão</div>
    <div class="card" style="padding:0;overflow:hidden">
      ${table(["#","Título","Módulo","Severidade"], fixedBugs.map(b => [
        b.id, b.title, b.module||"—", `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`
      ]))}
    </div>
  </div>` : ""}

  ${knownIssues.length ? `
  <div class="section">
    <div class="section-title">⚠️ Problemas Conhecidos</div>
    <div class="card" style="padding:0;overflow:hidden">
      ${table(["#","Título","Módulo","Severidade","Status","Observação"], knownIssues.map(b => [
        b.id, b.title, b.module||"—",
        `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`,
        SL[b.status]||b.status,
        b.comment||b.description||"—"
      ]))}
    </div>
  </div>` : `<div class="section"><div class="section-title">⚠️ Problemas Conhecidos</div><div class="card">Nenhum problema conhecido em aberto. ✅</div></div>`}

  <div class="section">
    <div class="section-title">Escopo Testado</div>
    <div class="card" style="padding:0;overflow:hidden">
      ${modulesTested.length ? table(["Módulo","Casos","Execuções","% Sucesso"], modulesTested.map(m => {
        const exec2 = Math.max(0,(m.total_executions||0)-(m.not_executed||0));
        const pct = exec2>0?((m.passed/exec2)*100).toFixed(1)+"%":"—";
        return [m.module||m.name, m.total_cases||0, exec2, pct];
      })) : `<div style="padding:16px;color:#64748B">Sem módulos testados neste período.</div>`}
    </div>
  </div>

</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#1E3A5F;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="footer">Release Notes de QA — ${projectName||"Projeto"} — ${now}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Release_Notes_QA_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Componente ────────────────────────────────────────────────
export function ExportButton({ style, filters }: ExportButtonProps) {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  const hasFilters = filters && Object.values(filters).some(Boolean);

  async function handle(type: string) {
    setLoading(type); setError("");
    try {
      if (type === "xlsx") await exportExcel(currentProject?.name, currentProject?.id, filters);
      if (type === "html") await exportHTML(currentProject?.name, currentProject?.id, filters);
      if (type === "bugs") await exportBugReport(currentProject?.name, currentProject?.id, filters);
      if (type === "executive") await exportExecutive(currentProject?.name, currentProject?.id, filters); // Quality Gate Report
      if (type === "release") await exportReleaseNotes(currentProject?.name, currentProject?.id, filters);
    } catch(e) {
      console.error(e);
      setError(e.message || "Erro ao exportar. Tente novamente.");
    } finally { setLoading(null); }
  }

  const [showMenu, setShowMenu] = useState<boolean>(false);

  return (
    <div style={{display:"inline-flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative"}}>
          <button className="btn" onClick={()=>setShowMenu(v=>!v)} disabled={!!loading}
            style={{...style, background:"#1E3A5F", color:"white", border:"none", fontWeight:600}}>
            {loading ? "⏳ Gerando…" : "⬇ Exportar ▾"}
          </button>
          {showMenu && (
            <>
            <div onClick={()=>setShowMenu(false)} style={{position:"fixed",inset:0,zIndex:99,background:"rgba(0,0,0,0.3)"}} />
            <div style={{position:"absolute",right:0,top:"110%",background:"#ffffff",
              border:"1px solid #E5E7EB",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)",
              zIndex:100,minWidth:220,overflow:"hidden"}}>

              {/* Dados */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6"}}>
                Dados
              </div>
              <button onClick={()=>{setShowMenu(false);handle("xlsx");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📊 Excel (.xlsx)
              </button>

              {/* Time de QA */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6",borderTop:"1px solid #F3F4F6"}}>
                👥 Para o Time de QA
              </div>
              <button onClick={()=>{setShowMenu(false);handle("html");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📄 Relatório Técnico (HTML+PDF)
              </button>
              <button onClick={()=>{setShowMenu(false);handle("bugs");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                🐛 Relatório de Defeitos
              </button>

              {/* Gestão / Cliente */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6",borderTop:"1px solid #F3F4F6"}}>
                🏢 Para Gestão / Cliente
              </div>
              <button onClick={()=>{setShowMenu(false);handle("executive");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                🎯 Quality Gate Report
              </button>
              <button onClick={()=>{setShowMenu(false);handle("release");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📋 Release Notes de QA
              </button>
            </div>
            </>
          )}
        </div>
        {hasFilters && (
          <span style={{fontSize:11, color:"var(--accent)", background:"var(--accent-bg)",
            padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap"}}>
            🔍 Filtros ativos
          </span>
        )}
      </div>
      {error && <span style={{fontSize:11,color:"var(--danger)"}}>{error}</span>}
    </div>
  );
}


