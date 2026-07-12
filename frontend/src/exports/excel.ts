import { fetchData,fetchDashboard,applyExportFilters,loadXLSX,applyStyles,SL,SVL,fd,envLabel,filterLabel } from "./shared";

export async function exportExcel(projectName, projectId, filters) {
  const rawData = await fetchData(projectId);
  const rawDash = await fetchDashboard(projectId, filters);
  const { data, finalMods = [] } = applyExportFilters(rawData, rawDash, filters);

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
    ["Total de casos",data.testCases.length],["Total executado",done],
    ["Passou",pass],["Falhou",fail],
    ["Bloqueado",data.executions.filter(e=>e.status==="blocked").length],
    ["Não executado",data.executions.filter(e=>e.status==="not_executed").length],
    ["Taxa de sucesso",sr],["Taxa de falha",fr],[""],
    ["RESUMO DE BUGS",""],["Total",data.bugs.length],
    ["Abertos",data.bugs.filter(b=>b.status==="open").length],
    ["Em andamento",data.bugs.filter(b=>b.status==="in_progress").length],
    ["Corrigidos",data.bugs.filter(b=>b.status==="fixed").length],
    ["Fechados",data.bugs.filter(b=>b.status==="closed").length],[""],
    ["BUGS POR AMBIENTE",""],
    ...[...new Set(data.bugs.map(b=>envLabel(b.environment)))].map(env => {
      const envBugs = data.bugs.filter(b=>envLabel(b.environment)===env);
      return [env, envBugs.length, `${envBugs.filter(b=>b.status==="open").length} abertos`];
    }).filter(r=>r[1]>0),[""],

  ];
  const sumWs=XLSX.utils.aoa_to_sheet(sumRows);
  sumWs["!cols"]=[{wch:24},{wch:44}];
  XLSX.utils.book_append_sheet(wb,sumWs,"Resumo");

  const tcH=["ID","Módulo","Título","Prioridade","Responsável","Pré-condições","Passos","Resultado esperado","Criado em"];
  // Aba Casos de Teste removida do relatório

  // Aba Ciclos removida do relatório

  // Aba Execuções removida do relatório

  const bgH=["#","Título","Módulo","Versão","TC","Severidade","Status","Criado por","Comentário","Tracker","Criado em"];
  const bgR=data.bugs.map(b=>[b.id,b.title,b.module||"—",b.version||"—",b.tc_id?`#${b.tc_id}`:"—",SVL[b.severity]||b.severity,SL[b.status]||b.status,b.created_by||"—",b.comment||"—",b.tracker_url||"—",fd(b.created_at)]);
  const bgWs=XLSX.utils.aoa_to_sheet([bgH,...bgR]);
  applyStyles(bgWs,bgH,bgR,"DC2626");
  bgWs["!cols"]=[{wch:6},{wch:36},{wch:16},{wch:10},{wch:10},{wch:10},{wch:14},{wch:18},{wch:30},{wch:30},{wch:12}];
  XLSX.utils.book_append_sheet(wb,bgWs,"Bugs");

  const mdH=["Módulo","Casos","Execuções","Passou","Falhou","Bloqueado","Total bugs","Bugs abertos","% Sucesso"];
  const mdR=data.modules.map(m=>{ const d2=m.total_executions||0; const pct=d2>0?((m.passed/d2)*100).toFixed(1)+"%":"—"; return [m.module||m.name,m.total_cases||0,d2,m.passed||0,m.failed||0,m.blocked||0,m.total_bugs||0,m.open_bugs||0,pct]; });
  const mdWs=XLSX.utils.aoa_to_sheet([mdH,...mdR]);
  applyStyles(mdWs,mdH,mdR,"D97706");
  mdWs["!cols"]=[{wch:20},{wch:8},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:10}];
  XLSX.utils.book_append_sheet(wb,mdWs,"Módulos");

  const date=new Date().toLocaleDateString("pt-BR").replace(/\//g,"-");
  XLSX.writeFile(wb,`QA_Report_${(projectName||"Export").replace(/\s+/g,"_")}_${date}.xlsx`);
}

// ── HTML com gráficos ─────────────────────────────────────────
