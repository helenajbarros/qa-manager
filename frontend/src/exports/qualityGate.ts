import { fetchData,fetchDashboard,applyExportFilters,SVL,filterLabel,openReport } from "./shared";

export async function exportExecutive(projectName, projectId, filters) {
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
  @media print{.no-print{display:none!important}body{background:white}.card{box-shadow:none;border:1px solid #E2E8F0}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}}
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
        <thead><tr><th>#</th><th>Título</th><th>Módulo</th><th>Versão</th><th>Severidade</th></tr></thead>
        <tbody>
          ${urgentBugs.map(b => `<tr>
            <td style="color:#64748B">${b.id}</td>
            <td style="font-weight:500">${b.title}</td>
            <td>${b.module||"—"}</td>
            <td>${b.version||"—"}</td>
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
            const exec2 = m.total_executions||0;
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
        const exec2 = modExec?.total_executions||0;
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

  openReport(html, `Relatorio_Executivo_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`);
}