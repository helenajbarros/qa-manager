import { fetchData,fetchDashboard,SL,SVL } from "./shared";

export async function exportRegressionReport(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const modName = filters?.module_id ? (rawDash.modules||[]).find(m=>String(m.id)===String(filters.module_id))?.name : null;
  const now = new Date().toLocaleString("pt-BR");

  const bugs   = modName ? (rawData.bugs||[]).filter(b=>b.module===modName)   : (rawData.bugs||[]);
  const cycles = rawData.cycles||[]; // ciclos não têm módulo próprio — não filtra por modName
  const execs  = modName ? (rawData.executions||[]).filter(e=>e.module===modName) : (rawData.executions||[]);

  // Reúne todas as versões conhecidas (bugs + ciclos) e ordena numericamente, mais recente primeiro
  const versions = [...new Set([
    ...bugs.map(b=>b.version).filter(Boolean),
    ...cycles.map(c=>c.version).filter(Boolean),
  ])].sort((a,b)=>String(b).localeCompare(String(a), undefined, {numeric:true}));

  const hasEnoughData = versions.length >= 2;
  const verNew = versions[0];
  const verOld = versions[1];

  function statsFor(version) {
    const vBugs = bugs.filter(b=>b.version===version);
    const vCycleNames = new Set(cycles.filter(c=>c.version===version).map(c=>c.name));
    const vExecs = execs.filter(e=>vCycleNames.has(e.cycle));
    const passed = vExecs.filter(e=>e.status==="passed").length;
    const failed = vExecs.filter(e=>e.status==="failed").length;
    const blocked = vExecs.filter(e=>e.status==="blocked").length;
    const executed = passed+failed+blocked;
    const successRate = executed>0 ? +((passed/executed)*100).toFixed(1) : null;
    return {
      version, bugs:vBugs, executed, successRate,
      critical: vBugs.filter(b=>b.severity==="critical").length,
      high: vBugs.filter(b=>b.severity==="high").length,
      open: vBugs.filter(b=>b.status==="open"||b.status==="in_progress").length,
      fixed: vBugs.filter(b=>b.status==="fixed"||b.status==="closed").length,
    };
  }

  const sNew = hasEnoughData ? statsFor(verNew) : null;
  const sOld = hasEnoughData ? statsFor(verOld) : null;

  // Heurística de regressão: bug corrigido/fechado na versão anterior, cujo título+módulo
  // reaparece aberto/em andamento na versão mais nova — ou seja, "voltou".
  const regressions = hasEnoughData ? sNew.bugs.filter(b =>
    (b.status==="open"||b.status==="in_progress") &&
    sOld.bugs.some(ob => (ob.status==="fixed"||ob.status==="closed") && ob.title===b.title && ob.module===b.module)
  ) : [];

  function delta(newVal, oldVal, unit="") {
    if (newVal==null || oldVal==null) return { text:"—", color:"#64748B" };
    const diff = +(newVal-oldVal).toFixed(1);
    if (diff === 0) return { text:`= 0${unit}`, color:"#64748B" };
    const positive = diff > 0;
    return { text:`${positive?"▲":"▼"} ${Math.abs(diff)}${unit}`, color: positive?"#10B981":"#EF4444" };
  }
  function deltaInverse(newVal, oldVal, unit="") {
    // para métricas onde "subir" é ruim (bugs, críticos etc.)
    if (newVal==null || oldVal==null) return { text:"—", color:"#64748B" };
    const diff = +(newVal-oldVal).toFixed(1);
    if (diff === 0) return { text:`= 0${unit}`, color:"#64748B" };
    const worse = diff > 0;
    return { text:`${diff>0?"▲":"▼"} ${Math.abs(diff)}${unit}`, color: worse?"#EF4444":"#10B981" };
  }

  function table(headers, rows) {
    const ths = headers.map(h=>`<th>${h}</th>`).join("");
    const trs = rows.map((r,i)=>`<tr class="${i%2?"even":""}">${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  const compareRows = hasEnoughData ? [
    ["Taxa de sucesso", sOld.successRate!=null?sOld.successRate+"%":"—", sNew.successRate!=null?sNew.successRate+"%":"—", (()=>{const d=delta(sNew.successRate,sOld.successRate,"%");return `<span style="color:${d.color}">${d.text}</span>`;})()],
    ["Bugs totais", sOld.bugs.length, sNew.bugs.length, (()=>{const d=deltaInverse(sNew.bugs.length,sOld.bugs.length);return `<span style="color:${d.color}">${d.text}</span>`;})()],
    ["Bugs críticos", sOld.critical, sNew.critical, (()=>{const d=deltaInverse(sNew.critical,sOld.critical);return `<span style="color:${d.color}">${d.text}</span>`;})()],
    ["Bugs altos", sOld.high, sNew.high, (()=>{const d=deltaInverse(sNew.high,sOld.high);return `<span style="color:${d.color}">${d.text}</span>`;})()],
    ["Bugs em aberto", sOld.open, sNew.open, (()=>{const d=deltaInverse(sNew.open,sOld.open);return `<span style="color:${d.color}">${d.text}</span>`;})()],
    ["Bugs corrigidos", sOld.fixed, sNew.fixed, (()=>{const d=delta(sNew.fixed,sOld.fixed);return `<span style="color:${d.color}">${d.text}</span>`;})()],
  ] : [];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório de Regressão — ${projectName||"Projeto"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F8FAFC;color:#1E293B;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .header{background:linear-gradient(135deg,#5B21B6,#7C3AED);color:white;padding:32px 40px;}
  .header h1{font-size:26px;margin-bottom:6px;}
  .header p{opacity:.85;font-size:14px;}
  .container{max-width:1100px;margin:0 auto;padding:32px 24px;}
  h2{font-size:20px;color:#5B21B6;margin:32px 0 16px;border-bottom:3px solid #7C3AED;padding-bottom:8px;}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);font-size:13px;margin-bottom:24px;}
  thead tr{background:#5B21B6;color:white;}
  th,td{padding:10px 14px;text-align:left;}
  tr.even td{background:#F8FAFC;}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
  .badge-critical{background:#FEE2E2;color:#7F1D1D;}
  .badge-high{background:#FEE2E2;color:#991B1B;}
  .badge-medium{background:#FEF3C7;color:#92400E;}
  .badge-low{background:#F3F4F6;color:#374151;}
  .warn-box{background:#FEF2F2;border:2px solid #DC2626;border-radius:10px;padding:16px 20px;margin-bottom:24px;}
  .footer{text-align:center;padding:32px;color:#94A3B8;font-size:12px;}
  .no-print{}
  @media print{
    .no-print{display:none!important}
    body{background:white}
    thead{display:table-header-group;}
    tr{break-inside:avoid;page-break-inside:avoid;}
  }
</style>
</head>
<body>
<div class="header">
  <h1>🔄 Relatório de Regressão — ${projectName||"Projeto"}</h1>
  <p>Gerado em ${now}${hasEnoughData?` — comparando v${verOld} → v${verNew}`:""}</p>
</div>
<div class="container">
${!hasEnoughData ? `
  <p style="color:#64748B;padding:24px;background:white;border-radius:12px">
    Ainda não há versões suficientes registradas em bugs ou ciclos para comparar (é preciso pelo menos 2 versões diferentes preenchidas no campo "Versão").
  </p>` : `
  <h2>Comparação: v${verOld} → v${verNew}</h2>
  ${table(["Métrica", `v${verOld} (anterior)`, `v${verNew} (atual)`, "Variação"], compareRows)}

  ${regressions.length > 0 ? `
  <div class="warn-box">
    <div style="font-size:15px;font-weight:700;color:#7F1D1D">⚠️ ${regressions.length} possível${regressions.length>1?"is":""} regressão${regressions.length>1?"ões":""} detectada${regressions.length>1?"s":""}</div>
    <div style="font-size:13px;color:#991B1B">Bug${regressions.length>1?"s":""} que estava${regressions.length>1?"m":""} corrigido${regressions.length>1?"s":""} na v${verOld} e voltou${regressions.length>1?"aram":""} a aparecer aberto${regressions.length>1?"s":""} na v${verNew} (mesmo título e módulo).</div>
  </div>
  <h2>Bugs Regressivos</h2>
  ${table(["#","Título","Módulo","Severidade","Status Atual"], regressions.map(b => [
    b.id, b.title, b.module||"—", `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`, SL[b.status]||b.status
  ]))}` : `<p style="color:#10B981;padding:0 0 24px">✅ Nenhuma regressão detectada entre as duas versões (nenhum bug corrigido na versão anterior reapareceu na atual).</p>`}

  <h2>Bugs Novos na v${verNew}</h2>
  ${sNew.bugs.length ? table(["#","Título","Módulo","Severidade","Status"], sNew.bugs
    .sort((a,b)=>{const o={critical:0,high:1,medium:2,low:3};return (o[a.severity]??9)-(o[b.severity]??9);})
    .map(b => [b.id, b.title, b.module||"—", `<span class="badge badge-${b.severity}">${SVL[b.severity]||b.severity}</span>`, SL[b.status]||b.status])
  ) : `<p style="color:#999">Nenhum bug registrado com a versão v${verNew}.</p>`}
`}
</div>
<div class="no-print" style="text-align:center;padding:24px">
  <button onclick="window.print()" style="background:#5B21B6;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit">
    🖨️ Imprimir / Salvar como PDF
  </button>
</div>
<div class="footer">QA Manager — Relatório de Regressão gerado em ${now} | ${projectName||"Projeto"}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Relatorio_Regressao_${(projectName||"Export").replace(/\s+/g,"_")}_${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Daily/Weekly Status ───────────────────────────────────────
