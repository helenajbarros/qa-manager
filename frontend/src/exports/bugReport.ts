import { fetchData,fetchDashboard,applyExportFilters,SL,SVL,fd,envLabel,filterLabel,resolutionDays } from "./shared";

export async function exportBugReport(projectName, projectId, filters) {
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
  const byEnv: Record<string, number> = {};
  const byModule: Record<string, any>   = {};
  const byVersion: Record<string, any>  = {};
  const isProdEnv = (env) => /prod/i.test(env||"");
  bugs.forEach(b => {
    if (b.severity in bySeverity) bySeverity[b.severity]++;
    if (b.status   in byStatus)   byStatus[b.status]++;
    const env = envLabel(b.environment);
    byEnv[env] = (byEnv[env]||0) + 1;
    const mod = b.module || "—";
    if (!byModule[mod]) byModule[mod] = { total:0, open:0, fixed:0 };
    byModule[mod].total++;
    if (b.status === "open") byModule[mod].open++;
    if (b.status === "fixed") byModule[mod].fixed++;
    if (b.version) {
      if (!byVersion[b.version]) byVersion[b.version] = { total:0, open:0, fixed:0 };
      byVersion[b.version].total++;
      if (b.status === "open") byVersion[b.version].open++;
      if (b.status === "fixed") byVersion[b.version].fixed++;
    }
  });

  // Bugs em produção = maior prioridade: já estão afetando o usuário final
  const prodOpenBugs = bugs.filter(b => isProdEnv(b.environment) && (b.status==="open"||b.status==="in_progress"));
  const prodCriticalOpen = prodOpenBugs.filter(b => b.severity==="critical").length;

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

  const envPalette = ["#2563EB","#8B5CF6","#0EA5E9","#D97706","#14B8A6","#6366F1"];
  const envColor = (env, idx) => isProdEnv(env) ? "#DC2626" : envPalette[idx % envPalette.length];

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

  const versionRows = Object.entries(byVersion)
    .sort((a,b) => b[0].localeCompare(a[0], undefined, {numeric:true}))
    .map(([v, m]) => [`v${v}`, m.total, `<span class="red">${m.open}</span>`, `<span class="green">${m.fixed}</span>`]);

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
    thead{display:table-header-group;}
    tr{break-inside:avoid;page-break-inside:avoid;}
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

  ${prodOpenBugs.length > 0 ? `
  <div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:10px;padding:16px 20px;margin-bottom:32px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div style="font-size:32px">🔴</div>
    <div>
      <div style="font-size:15px;font-weight:700;color:#7F1D1D">${prodOpenBugs.length} bug${prodOpenBugs.length>1?"s":""} em aberto em PRODUÇÃO${prodCriticalOpen>0?` (${prodCriticalOpen} crítico${prodCriticalOpen>1?"s":""})`:""}</div>
      <div style="font-size:13px;color:#991B1B">Bugs em produção já estão afetando o usuário final — priorize a correção destes antes dos demais ambientes.</div>
    </div>
  </div>` : ""}

  <h2>Gráficos</h2>
  <div class="charts">
    ${pieChart(sevPie,"Bugs por Severidade")}
    ${pieChart(statPie,"Bugs por Status")}
  </div>

  ${Object.values(byEnv).some(v=>v>0) ? `<h2>Bugs por Ambiente</h2><div class="cards">${
    Object.entries(byEnv).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([env,total],idx) => `
      <div class="card"><div class="val" style="color:${envColor(env,idx)}">${total}</div>
      <div class="lbl">${env}</div></div>`).join("")
  }</div>` : ""}

  ${moduleRows.length ? `<h2>Bugs por Módulo</h2>${table(["Módulo","Total","Abertos","Corrigidos"], moduleRows)}` : ""}

  ${versionRows.length ? `<h2>Bugs por Versão</h2>${table(["Versão","Total","Abertos","Corrigidos"], versionRows)}` : ""}

  <h2>Detalhamento dos Bugs</h2>
  ${bugs.length ? table(
    ["#","Título","Módulo","Versão","TC","Severidade","Status","Ambiente","Descrição","Criado por","Criado em","Resolvido em","Tempo de Resolução","Tracker"],
    bugs.map(b => {
      const days = resolutionDays(b);
      return [
      b.id,
      b.title,
      b.module||"—",
      b.version||"—",
      b.tc_id?`#${b.tc_id}`:"—",
      `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`,
      `<span class="badge badge-${b.status}">${SL[b.status]||b.status}</span>`,
      isProdEnv(b.environment) ? `<b style="color:#DC2626">${envLabel(b.environment)}</b>` : envLabel(b.environment),
      `<span class="desc-cell">${b.description||b.comment||"—"}</span>`,
      b.created_by||"—",
      fd(b.created_at),
      b.resolved_at ? fd(b.resolved_at) : "—",
      days!=null ? `${days} dia${days!==1?"s":""}` : "—",
      b.tracker_url?`<a href="${b.tracker_url}" target="_blank">Ver</a>`:"—",
    ];})
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
