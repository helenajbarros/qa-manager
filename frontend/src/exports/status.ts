import { fetchData,fetchDashboard,SVL } from "./shared";

export async function exportStatusReport(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const modName = filters?.module_id ? (rawDash.modules||[]).find(m=>String(m.id)===String(filters.module_id))?.name : null;
  const now = new Date();
  const nowLabel = now.toLocaleString("pt-BR");
  // Compara por data local (não UTC) — usar toISOString() aqui faria "hoje" virar
  // "amanhã" a partir das ~21h no horário do Brasil (UTC-3), escondendo bugs/execuções
  // do próprio dia no fim da tarde/noite.
  function localDateStr(d) {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }
  const todayStr = localDateStr(now);
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate()-7);

  const bugs  = modName ? (rawData.bugs||[]).filter(b=>b.module===modName)  : (rawData.bugs||[]);
  const execs = modName ? (rawData.executions||[]).filter(e=>e.module===modName) : (rawData.executions||[]);

  const isToday   = (d) => !!d && localDateStr(d) === todayStr;
  const isThisWeek = (d) => { if (!d) return false; const dt = new Date(d); return dt >= weekAgo; };

  const execsToday = execs.filter(e=>isToday(e.executed_at));
  const execsWeek  = execs.filter(e=>isThisWeek(e.executed_at));
  const bugsOpenedToday   = bugs.filter(b=>isToday(b.created_at));
  const bugsOpenedWeek    = bugs.filter(b=>isThisWeek(b.created_at));
  const bugsResolvedToday = bugs.filter(b=>isToday(b.resolved_at));
  const bugsResolvedWeek  = bugs.filter(b=>isThisWeek(b.resolved_at));

  function periodCard(execsP, bugsOpenedP, bugsResolvedP) {
    const passed = execsP.filter(e=>e.status==="passed").length;
    const failed = execsP.filter(e=>e.status==="failed").length;
    const blocked = execsP.filter(e=>e.status==="blocked").length;
    return `
    <div class="cards">
      <div class="card"><div class="val">${execsP.length}</div><div class="lbl">Execuções</div></div>
      <div class="card"><div class="val green">${passed}</div><div class="lbl">Passou</div></div>
      <div class="card"><div class="val red">${failed}</div><div class="lbl">Falhou</div></div>
      <div class="card"><div class="val purple">${blocked}</div><div class="lbl">Bloqueado</div></div>
      <div class="card"><div class="val" style="color:#EF4444">${bugsOpenedP.length}</div><div class="lbl">Bugs abertos</div></div>
      <div class="card"><div class="val green">${bugsResolvedP.length}</div><div class="lbl">Bugs resolvidos</div></div>
    </div>`;
  }

  function bugList(list, emptyMsg) {
    if (!list.length) return `<p style="color:#999;font-size:13px">${emptyMsg}</p>`;
    return `<ul class="bug-list">${list.slice(0,15).map(b=>`<li><b>#${b.id}</b> ${b.title} <span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span> <span style="color:#94A3B8">— ${b.module||"—"}</span></li>`).join("")}</ul>${list.length>15?`<p style="font-size:12px;color:#94A3B8">+ ${list.length-15} outro(s)</p>`:""}`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Status QA — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#1E3A5F,#2563EB);color:white;padding:28px 40px;}
  .header h1{font-size:24px;margin-bottom:4px;}
  .header p{opacity:.85;font-size:13px;}
  .container{max-width:900px;margin:0 auto;padding:28px 24px;}
  h2{font-size:18px;color:#1E3A5F;margin:28px 0 14px;border-bottom:3px solid #2563EB;padding-bottom:6px;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px;}
  .card{background:white;border-radius:10px;padding:14px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .card .val{font-size:22px;font-weight:700;margin:4px 0;}
  .card .lbl{font-size:11px;color:#64748B;}
  .green{color:#10B981;}.red{color:#EF4444;}.purple{color:#8B5CF6;}
  .bug-list{list-style:none;background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:8px 0;margin-bottom:16px;}
  .bug-list li{padding:8px 16px;font-size:13px;border-bottom:1px solid #F1F5F9;}
  .bug-list li:last-child{border-bottom:none;}
  .badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600;}
  .badge-critical{background:#FEE2E2;color:#7F1D1D;}
  .badge-high{background:#FEE2E2;color:#991B1B;}
  .badge-medium{background:#FEF3C7;color:#92400E;}
  .badge-low{background:#F3F4F6;color:#374151;}
  .footer{text-align:center;padding:24px;color:#94A3B8;font-size:12px;}
  .no-print{}
  @media print{.no-print{display:none!important}body{background:white}.card{box-shadow:none;border:1px solid #E2E8F0}}
</style>
</head>
<body>
<div class="header">
  <h1>📅 Status QA — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${nowLabel}</p>
</div>
<div class="container">
  <h2>Hoje (${new Date().toLocaleDateString("pt-BR")})</h2>
  ${periodCard(execsToday, bugsOpenedToday, bugsResolvedToday)}
  ${bugsOpenedToday.length ? `<div style="font-size:12px;color:#64748B;margin-bottom:4px">Bugs abertos hoje:</div>${bugList(bugsOpenedToday,"")}` : ""}

  <h2>Últimos 7 dias</h2>
  ${periodCard(execsWeek, bugsOpenedWeek, bugsResolvedWeek)}
  <div style="display:flex;gap:16px;flex-wrap:wrap">
    <div style="flex:1;min-width:260px">
      <div style="font-size:12px;color:#64748B;margin-bottom:4px">Bugs abertos na semana:</div>
      ${bugList(bugsOpenedWeek,"Nenhum bug aberto nos últimos 7 dias. ✅")}
    </div>
    <div style="flex:1;min-width:260px">
      <div style="font-size:12px;color:#64748B;margin-bottom:4px">Bugs resolvidos na semana:</div>
      ${bugList(bugsResolvedWeek,"Nenhum bug resolvido nos últimos 7 dias.")}
    </div>
  </div>
</div>
<div class="no-print" style="text-align:center;padding:20px">
  <button onclick="window.print()" style="background:#1E3A5F;color:white;border:none;padding:10px 28px;border-radius:8px;font-size:15px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<div class="footer">QA Manager — Status gerado em ${nowLabel} | ${projectName||"Projeto"}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Status_QA_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Relatório de Métricas ─────────────────────────────────────
