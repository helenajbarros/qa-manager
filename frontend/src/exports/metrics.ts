import { fetchData,fetchDashboard,SVL,fd,resolutionDays } from "./shared";

export async function exportMetricsReport(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const modName = filters?.module_id ? (rawDash.modules||[]).find(m=>String(m.id)===String(filters.module_id))?.name : null;
  const now = new Date().toLocaleString("pt-BR");

  const bugs = modName ? (rawData.bugs||[]).filter(b=>b.module===modName) : (rawData.bugs||[]);
  const cycles = [...(rawData.cycles||[])].sort((a,b)=> new Date(a.created_at||0) - new Date(b.created_at||0));

  function monthKey(d) { if(!d) return null; const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; }
  function monthLabel(key) { const [y,m] = key.split("-"); const names=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return `${names[parseInt(m)-1]}/${y.slice(2)}`; }

  const monthsSet = new Set();
  bugs.forEach(b => { if(b.created_at) monthsSet.add(monthKey(b.created_at)); if(b.resolved_at) monthsSet.add(monthKey(b.resolved_at)); });
  const months = [...monthsSet].sort().slice(-6);

  const monthlyData = months.map(mk => ({
    label: monthLabel(mk),
    opened: bugs.filter(b=>monthKey(b.created_at)===mk).length,
    resolved: bugs.filter(b=>monthKey(b.resolved_at)===mk).length,
  }));
  const maxMonthly = Math.max(1, ...monthlyData.map(m=>Math.max(m.opened,m.resolved)));

  const resolvedBugs = bugs.filter(b=>b.resolved_at);
  function avgDays(list) {
    const days = list.map(b=>resolutionDays(b)).filter(d=>d!=null);
    return days.length ? +(days.reduce((a,b)=>a+b,0)/days.length).toFixed(1) : null;
  }
  const avgAll = avgDays(resolvedBugs);
  const avgBySeverity = ["critical","high","medium","low"].map(sev => ({ sev, avg: avgDays(resolvedBugs.filter(b=>b.severity===sev)), count: resolvedBugs.filter(b=>b.severity===sev).length }));

  const cycleTrend = cycles.filter(c=>(c.total||0)>0).slice(-12).map(c => {
    const exec = (c.total||0)-(c.not_executed||0);
    const sr = exec>0 ? +((c.passed/exec)*100).toFixed(1) : null;
    return { name:c.name, version:c.version, date:fd(c.start_date), sr };
  });

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
<title>Relatório de Métricas — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#78350F,#B45309);color:white;padding:32px 40px;}
  .header h1{font-size:26px;margin-bottom:6px;}
  .header p{opacity:.85;font-size:14px;}
  .container{max-width:1100px;margin:0 auto;padding:32px 24px;}
  h2{font-size:20px;color:#78350F;margin:32px 0 16px;border-bottom:3px solid #B45309;padding-bottom:8px;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;}
  .card{background:white;border-radius:12px;padding:20px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .card .val{font-size:30px;font-weight:700;margin:8px 0;}
  .card .lbl{font-size:12px;color:#64748B;}
  .month-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .month-label{width:60px;font-size:13px;color:#475569;}
  .month-bars{flex:1;display:flex;flex-direction:column;gap:3px;}
  .month-bar-track{height:12px;background:#F1F5F9;border-radius:3px;overflow:hidden;}
  .month-bar-fill{height:100%;border-radius:3px;}
  .month-legend{display:flex;gap:16px;font-size:12px;color:#64748B;margin-bottom:12px;align-items:center;}
  .month-legend span{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:4px;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:13px;margin-bottom:24px;}
  thead tr{background:#78350F;color:white;}
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
  <h1>📊 Relatório de Métricas — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now} — tendências ao longo do tempo (histórico completo do projeto)</p>
</div>
<div class="container">
  <h2>Tempo de Resolução</h2>
  <div class="cards">
    <div class="card"><div class="val" style="color:#2563EB">${avgAll!=null?avgAll+" dias":"—"}</div><div class="lbl">Média geral</div></div>
    ${avgBySeverity.map(s=>`<div class="card"><div class="val" style="color:${s.sev==="critical"?"#DC2626":s.sev==="high"?"#EF4444":s.sev==="medium"?"#F59E0B":"#9CA3AF"}">${s.avg!=null?s.avg+"d":"—"}</div><div class="lbl">${SVL[s.sev]} (${s.count})</div></div>`).join("")}
  </div>

  <h2>Bugs Abertos vs Resolvidos por Mês</h2>
  <div class="month-legend"><span style="background:#EF4444"></span>Abertos <span style="background:#10B981"></span>Resolvidos</div>
  ${monthlyData.length ? monthlyData.map(m => `
    <div class="month-row">
      <div class="month-label">${m.label}</div>
      <div class="month-bars">
        <div class="month-bar-track"><div class="month-bar-fill" style="width:${(m.opened/maxMonthly*100).toFixed(0)}%;background:#EF4444"></div></div>
        <div class="month-bar-track"><div class="month-bar-fill" style="width:${(m.resolved/maxMonthly*100).toFixed(0)}%;background:#10B981"></div></div>
      </div>
      <div style="width:90px;font-size:12px;color:#64748B">${m.opened} / ${m.resolved}</div>
    </div>`).join("") : `<p style="color:#999">Sem dados suficientes de datas para montar a tendência mensal.</p>`}

  <h2>Tendência de Sucesso por Ciclo</h2>
  ${cycleTrend.length ? table(["Ciclo","Versão","Data","% Sucesso"], cycleTrend.map(c => [
    c.name, c.version?`v${c.version}`:"—", c.date,
    c.sr!=null ? `<span style="color:${c.sr>=80?"#10B981":c.sr>=50?"#F59E0B":"#EF4444"};font-weight:600">${c.sr}%</span>` : "—"
  ])) : `<p style="color:#999">Sem ciclos com execuções registradas.</p>`}
</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#78350F;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<div class="footer">QA Manager — Relatório de Métricas gerado em ${now} | ${projectName||"Projeto"}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Relatorio_Metricas_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Relatório de Risco ────────────────────────────────────────
