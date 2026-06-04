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
    ${pieChart(execPie,"Execuções por Status")}
    ${pieChart(bugPie,"Bugs por Status")}
    ${barChart(modData,"Resultados por Módulo")}
    ${trendChart(data.cycles)}
  </div>


  ${data.bugs.length > 0 ? `<h2>Bugs</h2>
  ${table(["#","Título","Módulo","Severidade","Status","Criado por","Tracker"],
    data.bugs.map(b=>[b.id,b.title,b.module||"—","<span class=\"badge badge-"+b.severity+"\">"+( SVL[b.severity]||b.severity)+"</span>","<span class=\"badge badge-"+b.status+"\">"+( SL[b.status]||b.status)+"</span>",b.created_by||"—",b.tracker_url?"<a href=\""+b.tracker_url+"\" target=\"_blank\">Ver</a>":"—"]))}`  : ""}
  ${data.modules.length > 0 ? `<h2>Métricas por Módulo</h2>
  ${table(["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Bugs","% Sucesso"],
    data.modules.map(m=>{const d2=(m.total_executions||0)-(m.not_executed||0);const pct=d2>0?((m.passed/d2)*100).toFixed(1)+"%":"—";return[m.module||m.name,m.total_cases||0,m.total_executions||0,"<span class=\"green\">"+( m.passed||0)+"</span>","<span class=\"red\">"+( m.failed||0)+"</span>",m.blocked||0,m.total_bugs||0,pct];}))}` : ""}
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


