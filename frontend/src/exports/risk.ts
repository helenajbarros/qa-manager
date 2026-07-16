import { fetchData,fetchDashboard,PL,SL,SVL,envLabel,openReport } from "./shared";

export async function exportRiskReport(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const modName = filters?.module_id ? (rawDash.modules||[]).find(m=>String(m.id)===String(filters.module_id))?.name : null;
  const now = new Date().toLocaleString("pt-BR");

  const allCases = modName ? (rawData.testCases||[]).filter(tc=>tc.module===modName) : (rawData.testCases||[]);
  const allExecs = modName ? (rawData.executions||[]).filter(e=>e.module===modName) : (rawData.executions||[]);
  const bugs     = modName ? (rawData.bugs||[]).filter(b=>b.module===modName)       : (rawData.bugs||[]);

  const testedTcIds = new Set(allExecs.filter(e=>e.status!=="not_executed").map(e=>e.tc_id));
  const untested = allCases.filter(tc=>!testedTcIds.has(tc.id))
    .sort((a,b)=> (PL[b.priority]?1:0) - (PL[a.priority]?1:0));

  const moduleStats: Record<string, any> = {};
  allCases.forEach(tc => {
    const mod = tc.module || "—";
    if (!moduleStats[mod]) moduleStats[mod] = { total:0, tested:0 };
    moduleStats[mod].total++;
    if (testedTcIds.has(tc.id)) moduleStats[mod].tested++;
  });
  const lowCoverageModules = Object.entries(moduleStats)
    .map(([mod,s]:[string,any]) => ({ mod, total:s.total, tested:s.tested, pct: s.total>0?Math.round((s.tested/s.total)*100):0 }))
    .filter(m => m.pct < 50)
    .sort((a,b) => a.pct - b.pct);

  const criticalOpen = bugs.filter(b => b.severity==="critical" && (b.status==="open"||b.status==="in_progress"));
  const highOpen      = bugs.filter(b => b.severity==="high"     && (b.status==="open"||b.status==="in_progress"));
  const prodOpen = bugs.filter(b => /prod/i.test(b.environment||"") && (b.status==="open"||b.status==="in_progress"));

  // Índice de risco simples combinando os fatores acima
  const riskPoints =
    criticalOpen.length * 10 +
    highOpen.length * 4 +
    prodOpen.length * 6 +
    untested.length * 1 +
    lowCoverageModules.length * 3;
  const riskLevel = riskPoints >= 40 ? { label:"ALTO", color:"#EF4444" } :
    riskPoints >= 15 ? { label:"MÉDIO", color:"#F59E0B" } :
    { label:"BAIXO", color:"#10B981" };

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
<title>Relatório de Risco — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#7C2D12,#B91C1C);color:white;padding:32px 40px;}
  .header h1{font-size:26px;margin-bottom:6px;}
  .header p{opacity:.85;font-size:14px;}
  .container{max-width:1100px;margin:0 auto;padding:32px 24px;}
  h2{font-size:20px;color:#7C2D12;margin:32px 0 16px;border-bottom:3px solid #B91C1C;padding-bottom:8px;}
  .risk-card{background:white;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.08);display:flex;align-items:center;gap:24px;margin-bottom:24px;flex-wrap:wrap;}
  .risk-badge{width:100px;height:100px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;}
  .risk-num{font-size:26px;font-weight:800;}
  .risk-lbl{font-size:11px;font-weight:700;letter-spacing:.05em;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;}
  .card{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .card .val{font-size:28px;font-weight:700;margin:8px 0;}
  .card .lbl{font-size:12px;color:#64748B;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:13px;margin-bottom:24px;}
  thead tr{background:#7C2D12;color:white;}
  th,td{padding:10px 14px;text-align:left;}
  tr.even td{background:#F8FAFC;}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
  .badge-critical{background:#FEE2E2;color:#7F1D1D;}
  .badge-high{background:#FEE2E2;color:#991B1B;}
  .footer{text-align:center;padding:32px;color:#94A3B8;font-size:12px;}
  .no-print{}
  @media print{
    .no-print{display:none!important}
    body{background:white}
    .card,.risk-card{box-shadow:none;border:1px solid #E2E8F0;break-inside:avoid;}
    thead{display:table-header-group;}
    tr{break-inside:avoid;page-break-inside:avoid;}
  }
</style>
</head>
<body>
<div class="header">
  <h1>🚨 Relatório de Risco — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now}</p>
</div>
<div class="container">
  <div class="risk-card">
    <div class="risk-badge" style="background:${riskLevel.color}20;border:3px solid ${riskLevel.color}">
      <div class="risk-num" style="color:${riskLevel.color}">${riskLevel.label}</div>
      <div class="risk-lbl" style="color:${riskLevel.color}">RISCO</div>
    </div>
    <div style="flex:1;font-size:14px;color:#475569">
      Avaliação combinando bugs críticos/altos em aberto, bugs em produção, casos nunca testados e módulos com baixa cobertura.
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="val" style="color:#DC2626">${criticalOpen.length}</div><div class="lbl">Críticos abertos</div></div>
    <div class="card"><div class="val" style="color:#EF4444">${highOpen.length}</div><div class="lbl">Altos abertos</div></div>
    <div class="card"><div class="val" style="color:#DC2626">${prodOpen.length}</div><div class="lbl">Abertos em produção</div></div>
    <div class="card"><div class="val" style="color:#F59E0B">${untested.length}</div><div class="lbl">Casos nunca testados</div></div>
    <div class="card"><div class="val" style="color:#F59E0B">${lowCoverageModules.length}</div><div class="lbl">Módulos com cobertura &lt; 50%</div></div>
  </div>

  <h2>Bugs Críticos e Altos em Aberto</h2>
  ${(criticalOpen.length+highOpen.length) ? table(["#","Título","Módulo","Severidade","Status","Ambiente"], [...criticalOpen,...highOpen].map(b => [
    b.id, b.title, b.module||"—", `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`, SL[b.status]||b.status, envLabel(b.environment)
  ])) : `<p style="color:#10B981">✅ Nenhum bug crítico ou alto em aberto.</p>`}

  <h2>Módulos com Cobertura Abaixo de 50%</h2>
  ${lowCoverageModules.length ? table(["Módulo","Casos","Testados","Cobertura"], lowCoverageModules.map(m => [
    m.mod, m.total, m.tested, `<span style="color:#EF4444;font-weight:600">${m.pct}%</span>`
  ])) : `<p style="color:#10B981">✅ Nenhum módulo com cobertura abaixo de 50%.</p>`}

  <h2>Casos Nunca Testados${untested.length ? ` (${untested.length})` : ""}</h2>
  ${untested.length ? table(["#","Título","Módulo","Prioridade"], untested.slice(0,50).map(tc => [
    tc.id, tc.title, tc.module||"—", PL[tc.priority]||tc.priority||"—"
  ])) : `<p style="color:#10B981">✅ Todos os casos já foram testados ao menos uma vez.</p>`}
  ${untested.length > 50 ? `<p style="font-size:12px;color:#94A3B8">+ ${untested.length-50} outro(s) caso(s) não exibido(s) — veja o Relatório de Cobertura completo.</p>` : ""}
</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#7C2D12;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<div class="footer">QA Manager — Relatório de Risco gerado em ${now} | ${projectName||"Projeto"}</div>
</body>
</html>`;

  openReport(html, `Relatorio_Risco_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`);
}