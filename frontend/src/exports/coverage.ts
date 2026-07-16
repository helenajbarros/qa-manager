import { fetchData,fetchDashboard,PL,fd,filterLabel,openReport } from "./shared";

export async function exportCoverageReport(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const modName = filters?.module_id ? (rawDash.modules||[]).find(m=>String(m.id)===String(filters.module_id))?.name : null;
  const now = new Date().toLocaleString("pt-BR");
  const fLabel = filterLabel(filters);

  // Cobertura é uma métrica de "já foi testado alguma vez" — por isso ignora
  // filtro de ciclo/período/status aqui (esses filtram execução pontual, não histórico).
  // Só o filtro de módulo faz sentido restringir o escopo do relatório.
  const allCases = modName ? (rawData.testCases||[]).filter(tc=>tc.module===modName) : (rawData.testCases||[]);
  const allExecs = modName ? (rawData.executions||[]).filter(e=>e.module===modName) : (rawData.executions||[]);

  const testedTcIds = new Set(allExecs.filter(e=>e.status!=="not_executed").map(e=>e.tc_id));
  const totalCases = allCases.length;
  const testedCount = allCases.filter(tc=>testedTcIds.has(tc.id)).length;
  const untested = allCases.filter(tc=>!testedTcIds.has(tc.id))
    .sort((a,b)=> new Date(a.created_at||0) - new Date(b.created_at||0));
  const coveragePct = totalCases>0 ? +((testedCount/totalCases)*100).toFixed(1) : 0;

  const moduleStats: Record<string, any> = {};
  allCases.forEach(tc => {
    const mod = tc.module || "—";
    if (!moduleStats[mod]) moduleStats[mod] = { total:0, tested:0 };
    moduleStats[mod].total++;
    if (testedTcIds.has(tc.id)) moduleStats[mod].tested++;
  });
  const moduleRows = Object.entries(moduleStats)
    .map(([mod,s]:[string,any]) => ({ mod, total:s.total, tested:s.tested, pct: s.total>0?Math.round((s.tested/s.total)*100):0 }))
    .sort((a,b) => a.pct - b.pct);

  function pctColor(pct) { return pct>=80?"#10B981":pct>=50?"#F59E0B":"#EF4444"; }

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
<title>Relatório de Cobertura — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#0F766E,#0D9488);color:white;padding:32px 40px;}
  .header h1{font-size:26px;margin-bottom:6px;}
  .header p{opacity:.85;font-size:14px;}
  .filter-badge{background:#F0FDFA;border:1px solid #99F6E4;border-radius:8px;padding:8px 16px;margin:16px 40px 0;font-size:13px;color:#0F766E;}
  .container{max-width:1200px;margin:0 auto;padding:32px 24px;}
  h2{font-size:20px;color:#0F766E;margin:32px 0 16px;border-bottom:3px solid #0D9488;padding-bottom:8px;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:32px;}
  .card{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .card .val{font-size:30px;font-weight:700;margin:8px 0;}
  .card .lbl{font-size:12px;color:#64748B;}
  .bar-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .bar-label{width:180px;font-size:13px;text-align:right;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .bar-track{flex:1;height:16px;background:#F1F5F9;border-radius:4px;overflow:hidden;}
  .bar-fill{height:100%;border-radius:4px;}
  .bar-pct{width:70px;font-size:13px;font-weight:600;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:13px;margin-bottom:24px;}
  thead tr{background:#0F766E;color:white;}
  th,td{padding:10px 14px;text-align:left;}
  tr.even td{background:#F8FAFC;}
  .footer{text-align:center;padding:32px;color:#94A3B8;font-size:12px;}
  .no-print{}
  @media print{
    .no-print{display:none!important}
    body{background:white}
    .card{box-shadow:none;border:1px solid #E2E8F0;break-inside:avoid;}
    thead{display:table-header-group;}
    tr{break-inside:avoid;page-break-inside:avoid;}
  }
</style>
</head>
<body>
<div class="header">
  <h1>📈 Relatório de Cobertura — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now}</p>
</div>
${fLabel?`<div class="filter-badge">🔍 ${fLabel} — cobertura considera todo o histórico, filtro de período não se aplica aqui</div>`:""}
<div class="container">
  <h2>Resumo</h2>
  <div class="cards">
    <div class="card"><div class="val" style="color:#2563EB">${totalCases}</div><div class="lbl">Casos cadastrados</div></div>
    <div class="card"><div class="val" style="color:#10B981">${testedCount}</div><div class="lbl">Já testados</div></div>
    <div class="card"><div class="val" style="color:${pctColor(coveragePct)}">${coveragePct}%</div><div class="lbl">Cobertura geral</div></div>
    <div class="card"><div class="val" style="color:${untested.length>0?"#EF4444":"#10B981"}">${untested.length}</div><div class="lbl">Nunca testados</div></div>
  </div>

  <h2>Cobertura por Módulo</h2>
  ${moduleRows.map(m => `
    <div class="bar-row">
      <div class="bar-label">${m.mod}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${m.pct}%;background:${pctColor(m.pct)}"></div></div>
      <div class="bar-pct" style="color:${pctColor(m.pct)}">${m.pct}% (${m.tested}/${m.total})</div>
    </div>`).join("") || `<p style="color:#999">Sem módulos com casos cadastrados.</p>`}

  <h2>Casos Nunca Testados${untested.length ? ` (${untested.length})` : ""}</h2>
  ${untested.length ? table(
    ["#","Título","Módulo","Prioridade","Responsável","Criado em"],
    untested.map(tc => [tc.id, tc.title, tc.module||"—", PL[tc.priority]||tc.priority||"—", tc.assigned_to||"—", fd(tc.created_at)])
  ) : `<p style="color:#10B981">✅ Todos os casos cadastrados já foram testados ao menos uma vez.</p>`}
</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#0F766E;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<div class="footer">QA Manager — Relatório de Cobertura gerado em ${now} | ${projectName||"Projeto"}</div>
</body>
</html>`;

  openReport(html, `Relatorio_Cobertura_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`);
}