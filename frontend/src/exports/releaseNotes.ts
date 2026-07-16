import { fetchData,fetchDashboard,applyExportFilters,SL,SVL,envLabel,filterLabel,openReport } from "./shared";

export async function exportReleaseNotes(projectName, projectId, filters) {
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
  // Bugs em produção = maior prioridade: já estão afetando o usuário final
  // (detecta por nome pois o ambiente é customizável por projeto — pode não ser "production" literal)
  const isProdEnv = (env) => /prod/i.test(env||"");
  const prodOpenIssues = knownIssues.filter(b => isProdEnv(b.environment));

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
  @media print{.no-print{display:none!important}body{background:white}.card{box-shadow:none;border:1px solid #E2E8F0}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}}
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

  ${prodOpenIssues.length > 0 ? `
  <div class="section">
    <div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="font-size:32px">🔴</div>
      <div>
        <div style="font-size:15px;font-weight:700;color:#7F1D1D">${prodOpenIssues.length} problema${prodOpenIssues.length>1?"s":""} conhecido${prodOpenIssues.length>1?"s":""} em PRODUÇÃO</div>
        <div style="font-size:13px;color:#991B1B">Estes já estão em ambiente de produção e afetam o usuário final agora — comunique este risco antes do lançamento desta versão.</div>
      </div>
    </div>
  </div>` : ""}

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
      ${table(["#","Título","Módulo","Versão","Severidade"], fixedBugs.map(b => [
        b.id, b.title, b.module||"—", b.version||"—", `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`
      ]))}
    </div>
  </div>` : ""}

  ${knownIssues.length ? `
  <div class="section">
    <div class="section-title">⚠️ Problemas Conhecidos</div>
    <div class="card" style="padding:0;overflow:hidden">
      ${table(["#","Título","Módulo","Versão","Ambiente","Severidade","Status","Observação"], knownIssues.map(b => [
        b.id, b.title, b.module||"—", b.version||"—",
        isProdEnv(b.environment) ? `<b style="color:#DC2626">${envLabel(b.environment)}</b>` : envLabel(b.environment),
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
        const exec2 = m.total_executions||0;
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

  openReport(html, `Release_Notes_QA_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`);
}