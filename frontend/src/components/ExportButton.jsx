import { useState } from "react";
import { useProject } from "../context/ProjectContext.jsx";

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

async function fetchDashboard(projectId) {
  const res = await fetch(`${getBase()}/dashboard${projectId?`?project_id=${projectId}`:""}`, { headers:{Authorization:`Bearer ${getToken()}`} });
  if (!res.ok) return {};
  const json = await res.json();
  return json.data ?? json ?? {};
}

// ── Aplica filtros nos dados exportados ───────────────────────
function applyExportFilters(data, dash, filters) {
  if (!filters || !Object.values(filters).some(Boolean)) return { data, dash };

  const { date_from, date_to, module_id, status } = filters;

  // Filtra ciclos por período (sobreposição de datas)
  const from = date_from ? new Date(date_from) : null;
  const to   = date_to   ? new Date(date_to+"T23:59:59") : null;
  const filteredCycles = (data.cycles || []).filter(c => {
    const cStart = c.start_date ? new Date(c.start_date) : null;
    const cEnd   = c.end_date   ? new Date(c.end_date)   : null;
    if (from && cEnd   && cEnd   < from) return false;
    if (to   && cStart && cStart > to)   return false;
    return true;
  });

  // Nomes dos ciclos filtrados para filtrar execuções (execuções têm "cycle" = nome)
  const cycleNames = new Set(filteredCycles.map(c => c.name));

  // Filtra execuções: por ciclo (nome) + status + módulo
  let filteredExec = (data.executions || []).filter(e => {
    if (cycleNames.size > 0 && !cycleNames.has(e.cycle)) return false;
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
  const filteredBugs = modName ? data.bugs?.filter(b => b.module === modName) : data.bugs;
  const filteredMods = modName ? data.modules?.filter(m => m.name === modName) : data.modules;

  // Recalcula summary a partir das execuções filtradas
  const passed   = filteredExec.filter(e=>e.status==="passed").length;
  const failed   = filteredExec.filter(e=>e.status==="failed").length;
  const blocked  = filteredExec.filter(e=>e.status==="blocked").length;
  const notExec  = filteredExec.filter(e=>e.status==="not_executed").length;
  const total    = filteredExec.length;
  const executed = total - notExec;

  const filteredDash = {
    ...dash,
    summary: {
      ...(dash.summary||{}),
      passed, failed, blocked, not_executed: notExec,
      total_executions: total,
      success_rate: executed>0?+((passed/executed)*100).toFixed(1):0,
      fail_rate:    executed>0?+((failed/executed)*100).toFixed(1):0,
    },
    modules: modName ? (dash.modules||[]).filter(m=>m.name===modName) : dash.modules,
  };

  return {
    data: { ...data, cycles: filteredCycles, executions: filteredExec, testCases: filteredTC||[], bugs: filteredBugs||[], modules: filteredMods||[] },
    dash: filteredDash,
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
const fd = d => { try { return d?new Date(d).toLocaleDateString("pt-BR"):"—"; } catch{return d||"—";} };

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
  const rawDash = await fetchDashboard(projectId);
  const { data } = applyExportFilters(rawData, rawDash, filters);

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
    ["Total de casos",data.testCases.length],["Total de execuções",data.executions.length],
    ["Passou",pass],["Falhou",fail],
    ["Bloqueado",data.executions.filter(e=>e.status==="blocked").length],
    ["Não executado",data.executions.filter(e=>e.status==="not_executed").length],
    ["Taxa de sucesso",sr],["Taxa de falha",fr],[""],
    ["RESUMO DE BUGS",""],["Total",data.bugs.length],
    ["Abertos",data.bugs.filter(b=>b.status==="open").length],
    ["Em andamento",data.bugs.filter(b=>b.status==="in_progress").length],
    ["Corrigidos",data.bugs.filter(b=>b.status==="fixed").length],
    ["Fechados",data.bugs.filter(b=>b.status==="closed").length],[""],
    ["CICLOS",""],...data.cycles.map(c=>[c.name,`${c.passed||0} ✓  ${c.failed||0} ✗  ${c.total||0} total`])
  ];
  const sumWs=XLSX.utils.aoa_to_sheet(sumRows);
  sumWs["!cols"]=[{wch:24},{wch:44}];
  XLSX.utils.book_append_sheet(wb,sumWs,"Resumo");

  const tcH=["ID","Módulo","Título","Prioridade","Responsável","Pré-condições","Passos","Resultado esperado","Criado em"];
  const tcR=data.testCases.map(tc=>[tc.id,tc.module||"—",tc.title,PL[tc.priority]||tc.priority,tc.assigned_to||"—",tc.preconditions||"—",tc.steps||"—",tc.expected_result||"—",fd(tc.created_at)]);
  const tcWs=XLSX.utils.aoa_to_sheet([tcH,...tcR]);
  applyStyles(tcWs,tcH,tcR,"2563EB");
  tcWs["!cols"]=[{wch:6},{wch:16},{wch:36},{wch:10},{wch:18},{wch:28},{wch:36},{wch:28},{wch:12}];
  XLSX.utils.book_append_sheet(wb,tcWs,"Casos de Teste");

  const cyH=["Ciclo","Versão","Status","Início","Fim","Tipos","Total","Passou","Falhou","Bloqueado","Não exec","% Sucesso"];
  const cyR=data.cycles.map(c=>{ const d2=(c.total||0)-(c.not_executed||0); const pct=d2>0?((c.passed/d2)*100).toFixed(1)+"%":"—"; return [c.name,c.version||"—",SL[c.status]||c.status,fd(c.start_date),fd(c.end_date),c.test_types?c.test_types.split(",").join(", "):"—",c.total||0,c.passed||0,c.failed||0,c.blocked||0,c.not_executed||0,pct]; });
  const cyWs=XLSX.utils.aoa_to_sheet([cyH,...cyR]);
  applyStyles(cyWs,cyH,cyR,"7C3AED");
  cyWs["!cols"]=[{wch:24},{wch:10},{wch:12},{wch:12},{wch:12},{wch:28},{wch:8},{wch:8},{wch:8},{wch:10},{wch:10},{wch:10}];
  XLSX.utils.book_append_sheet(wb,cyWs,"Ciclos");

  const exH=["Ciclo","TC #","Caso de teste","Módulo","Status","Executado por","Responsável","Comentário","URL Evidência","Bug vinculado","Executado em"];
  const exR=data.executions.map(e=>[e.cycle,e.tc_id,e.test_case,e.module||"—",SL[e.status]||e.status,e.executed_by||"—",e.assigned_to||"—",e.comment||"—",e.evidence_url||"—",e.bug_id?`#${e.bug_id} ${e.bug_title}`:"—",fd(e.executed_at)]);
  const exWs=XLSX.utils.aoa_to_sheet([exH,...exR]);
  applyStyles(exWs,exH,exR,"059669");
  exWs["!cols"]=[{wch:20},{wch:6},{wch:32},{wch:16},{wch:14},{wch:18},{wch:18},{wch:30},{wch:30},{wch:24},{wch:14}];
  XLSX.utils.book_append_sheet(wb,exWs,"Execuções");

  const bgH=["#","Título","Módulo","TC","Severidade","Status","Criado por","Comentário","Tracker","Criado em"];
  const bgR=data.bugs.map(b=>[b.id,b.title,b.module||"—",b.tc_id?`#${b.tc_id}`:"—",SVL[b.severity]||b.severity,SL[b.status]||b.status,b.created_by||"—",b.comment||"—",b.tracker_url||"—",fd(b.created_at)]);
  const bgWs=XLSX.utils.aoa_to_sheet([bgH,...bgR]);
  applyStyles(bgWs,bgH,bgR,"DC2626");
  bgWs["!cols"]=[{wch:6},{wch:36},{wch:16},{wch:10},{wch:10},{wch:14},{wch:18},{wch:30},{wch:30},{wch:12}];
  XLSX.utils.book_append_sheet(wb,bgWs,"Bugs");

  const mdH=["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Total bugs","Bugs abertos","% Sucesso"];
  const mdR=data.modules.map(m=>{ const d2=(m.total_executions||0)-(m.not_executed||0); const pct=d2>0?((m.passed/d2)*100).toFixed(1)+"%":"—"; return [m.module||m.name,m.total_cases||0,m.total_executions||0,m.passed||0,m.failed||0,m.blocked||0,m.total_bugs||0,m.open_bugs||0,pct]; });
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
  const rawDash = await fetchDashboard(projectId);
  const { data, dash } = applyExportFilters(rawData, rawDash, filters);

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

  const modData = (dash.modules||[]).slice(0,10);

  function pieChart(items, title) {
    const total = items.reduce((a,b)=>a+b.value,0);
    if (!total) return `<div class="chart-box"><h3>${title}</h3><p style="color:#999;text-align:center">Sem dados</p></div>`;
    let angle=-90, paths="", legends="";
    items.forEach(item => {
      const pct=item.value/total;
      const a1=angle*Math.PI/180, a2=(angle+pct*360)*Math.PI/180;
      const x1=100+80*Math.cos(a1), y1=100+80*Math.sin(a1);
      const x2=100+80*Math.cos(a2), y2=100+80*Math.sin(a2);
      paths+=`<path d="M100,100 L${x1},${y1} A80,80 0 ${pct>.5?1:0},1 ${x2},${y2} Z" fill="${item.color}" stroke="white" stroke-width="2"/>`;
      legends+=`<div class="legend-item"><span class="legend-dot" style="background:${item.color}"></span>${item.label}: <b>${item.value}</b> (${(pct*100).toFixed(1)}%)</div>`;
      angle+=pct*360;
    });
    return `<div class="chart-box"><h3>${title}</h3><div class="pie-wrap"><svg viewBox="0 0 200 200" width="180" height="180">${paths}</svg><div class="legends">${legends}</div></div></div>`;
  }

  function barChart(items, title) {
    if (!items.length) return `<div class="chart-box wide"><h3>${title}</h3><p style="color:#999">Sem dados</p></div>`;
    const bars=items.map(m=>{ const p=m.passed||0,f=m.failed||0,bl=m.blocked||0,ne=m.not_executed||0,tot=p+f+bl+ne||1;
      return `<div class="bar-row"><div class="bar-label">${m.name}</div><div class="bar-track">
        <div class="bar-seg" style="width:${(p/tot*100).toFixed(1)}%;background:#10B981" title="Passou: ${p}"></div>
        <div class="bar-seg" style="width:${(f/tot*100).toFixed(1)}%;background:#EF4444" title="Falhou: ${f}"></div>
        <div class="bar-seg" style="width:${(bl/tot*100).toFixed(1)}%;background:#8B5CF6" title="Bloqueado: ${bl}"></div>
        <div class="bar-seg" style="width:${(ne/tot*100).toFixed(1)}%;background:#E5E7EB" title="Não exec: ${ne}"></div>
      </div><div class="bar-nums">${p}✓ ${f}✗</div></div>`;
    }).join("");
    return `<div class="chart-box wide"><h3>${title}</h3><div class="bar-legend"><span style="background:#10B981"></span>Passou <span style="background:#EF4444"></span>Falhou <span style="background:#8B5CF6"></span>Bloqueado <span style="background:#E5E7EB;border:1px solid #ccc"></span>Não exec</div>${bars}</div>`;
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
  h2{font-size:20px;color:#1E3A5F;margin:32px 0 16px;border-bottom:3px solid #2563EB;padding-bottom:8px;}
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
    svg{display:block!important;visibility:visible!important;}
    svg path{display:block!important;}
    .pie-wrap{display:flex!important;}
    h2{break-before:auto;}
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
    ${pieChart(execPie,"Execuções por Status")}
    ${pieChart(bugPie,"Bugs por Status")}
    ${barChart(modData,"Resultados por Módulo")}
  </div>
  <h2>Casos de Teste</h2>
  ${table(["ID","Módulo","Título","Prioridade","Responsável"],
    data.testCases.map(tc=>[tc.id,tc.module||"—",tc.title,`<span class="badge badge-${tc.priority}">${PL[tc.priority]||tc.priority}</span>`,tc.assigned_to||"—"]))}
  <h2>Ciclos de Teste</h2>
  ${table(["Ciclo","Versão","Status","Início","Fim","Total","Passou","Falhou","% Sucesso"],
    data.cycles.map(c=>{const d2=(c.total||0)-(c.not_executed||0);const pct=d2>0?((c.passed/d2)*100).toFixed(1)+"%":"—";return[c.name,c.version||"—",`<span class="badge badge-${c.status}">${SL[c.status]||c.status}</span>`,fd(c.start_date),fd(c.end_date),c.total||0,`<span class="green">${c.passed||0}</span>`,`<span class="red">${c.failed||0}</span>`,pct];}))}
  <h2>Execuções</h2>
  ${table(["Ciclo","TC #","Caso de teste","Módulo","Status","Executado por","Comentário"],
    data.executions.map(e=>[e.cycle,e.tc_id,e.test_case,e.module||"—",`<span class="badge badge-${e.status}">${SL[e.status]||e.status}</span>`,e.executed_by||"—",e.comment||"—"]))}
  <h2>Bugs</h2>
  ${table(["#","Título","Módulo","Severidade","Status","Criado por","Tracker"],
    data.bugs.map(b=>[b.id,b.title,b.module||"—",`<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`,`<span class="badge badge-${b.status}">${SL[b.status]||b.status}</span>`,b.created_by||"—",b.tracker_url?`<a href="${b.tracker_url}" target="_blank">Ver</a>`:"—"]))}
  <h2>Métricas por Módulo</h2>
  ${table(["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Bugs","% Sucesso"],
    data.modules.map(m=>{const d2=(m.total_executions||0)-(m.not_executed||0);const pct=d2>0?((m.passed/d2)*100).toFixed(1)+"%":"—";return[m.module||m.name,m.total_cases||0,m.total_executions||0,`<span class="green">${m.passed||0}</span>`,`<span class="red">${m.failed||0}</span>`,m.blocked||0,m.total_bugs||0,pct];}))}
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

// ── Componente ────────────────────────────────────────────────
export function ExportButton({ style, filters }) {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState("");

  const hasFilters = filters && Object.values(filters).some(Boolean);

  async function handle(type) {
    setLoading(type); setError("");
    try {
      if (type === "xlsx") await exportExcel(currentProject?.name, currentProject?.id, filters);
      if (type === "html") await exportHTML(currentProject?.name, currentProject?.id, filters);
    } catch(e) {
      console.error(e);
      setError(e.message || "Erro ao exportar. Tente novamente.");
    } finally { setLoading(null); }
  }

  return (
    <div style={{display:"inline-flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button className="btn" onClick={()=>handle("xlsx")} disabled={!!loading}
          style={{...style, background:"#dee8fc", color:"#1E3A5F", border:"none", fontWeight:600}}>
          {loading==="xlsx" ? "⏳ Gerando…" : "⬇ Excel"}
        </button>
        <button className="btn" onClick={()=>handle("html")} disabled={!!loading}
          style={{...style, background:"#dee8fc", color:"#1E3A5F", border:"none", fontWeight:600}}>
          {loading==="html" ? "⏳ Gerando…" : "📊 HTML + PDF"}
        </button>
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


