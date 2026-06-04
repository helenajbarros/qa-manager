import { useState, useMemo } from "react";
import { useAsync }      from "../hooks/useAsync.js";
import { dashboardApi }  from "../services/resources.js";
import { useProject }    from "../context/ProjectContext.jsx";
import { Loading, ErrorMsg } from "../components/UI.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ExportButton } from "../components/ExportButton.jsx";

const PIE_COLORS  = ["#16A34A","#DC2626","#7C3AED","#9CA3AF"];
const EXEC_COLORS = { "Passou":"#16A34A", "Falhou":"#DC2626", "Bloqueado":"#7C3AED", "Não executado":"#9CA3AF" };
const BUG_COLORS  = { "Aberto":"#DC2626", "Em andamento":"#F59E0B", "Corrigido":"#16A34A", "Fechado":"#9CA3AF" };
const PAGE_SIZE  = 5;

function MetricCard({ label, value, sub, color, id }) {
  return (
    <div className="metric-card" id={id}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={color?{color}:{}}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function StackBar({ passed=0, failed=0, blocked=0, not_executed=0 }) {
  const total = passed+failed+blocked+not_executed;
  if (!total) return <div style={{ height:8, background:"var(--border)", borderRadius:4 }} />;
  return (
    <div style={{ display:"flex", height:8, borderRadius:4, overflow:"hidden", gap:1 }}>
      {passed>0      && <div style={{ flex:passed,       background:"#16A34A" }} title={`Passou: ${passed}`} />}
      {failed>0      && <div style={{ flex:failed,       background:"#DC2626" }} title={`Falhou: ${failed}`} />}
      {blocked>0     && <div style={{ flex:blocked,      background:"#7C3AED" }} title={`Bloqueado: ${blocked}`} />}
      {not_executed>0&& <div style={{ flex:not_executed, background:"#E5E7EB" }} title={`Não exec: ${not_executed}`} />}
    </div>
  );
}

function CycleCard({ cycle }) {
  const exec    = cycle.total_executions || 0;
  const pct     = exec > 0 ? Math.round((cycle.passed/exec)*100) : 0;
  const types   = cycle.test_types ? cycle.test_types.split(",").filter(Boolean) : [];
  const fmtDate = d => d ? new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}) : null;
  const startD  = fmtDate(cycle.start_date);
  const endD    = fmtDate(cycle.end_date);
  let duration  = null;
  if (cycle.start_date && cycle.end_date) {
    const days = Math.round((new Date(cycle.end_date)-new Date(cycle.start_date))/(1000*60*60*24));
    duration = `${days} dias`;
  }
  return (
    <div className="card" style={{ marginBottom:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14 }}>{cycle.name}</div>
          {cycle.version && <div style={{ fontSize:11, color:"var(--accent)", marginTop:2 }}>v{cycle.version}</div>}
        </div>
        <span className={`badge badge-${cycle.status}`}>
          {cycle.status==="active"?"Ativo":cycle.status==="completed"?"Concluído":"Arquivado"}
        </span>
      </div>
      {(startD||endD) && (
        <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8, display:"flex", gap:8, flexWrap:"wrap" }}>
          {startD && <span>📅 Início: {startD}</span>}
          {endD   && <span>🏁 Fim: {endD}</span>}
          {duration && <span>⏱ {duration}</span>}
        </div>
      )}
      {types.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
          {types.map(t => (
            <span key={t} style={{ fontSize:10, padding:"1px 6px", borderRadius:10,
              background:"var(--accent-bg)", color:"var(--accent)" }}>{t}</span>
          ))}
        </div>
      )}
      <StackBar passed={cycle.passed} failed={cycle.failed} blocked={cycle.blocked} not_executed={cycle.not_executed} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:12 }}>
        <div style={{ display:"flex", gap:12 }}>
          <span style={{ color:"#16A34A" }}>✓ {cycle.passed||0}</span>
          <span style={{ color:"#DC2626" }}>✗ {cycle.failed||0}</span>
          <span style={{ color:"#7C3AED" }}>⊘ {cycle.blocked||0}</span>
          <span style={{ color:"var(--text-muted)" }}>— {cycle.not_executed||0}</span>
        </div>
        <span style={{ fontWeight:600, color: pct>=70?"#16A34A":pct>=40?"#D97706":"#DC2626" }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ── Tabela expansível com paginação ──────────────────────────
function ExpandableTable({ title, id, headers, rows, renderRow, totalCount }) {
  const [expanded, setExpanded] = useState(false);
  const [page,     setPage]     = useState(1);
  const pageSize   = expanded ? PAGE_SIZE : PAGE_SIZE;
  const totalPages = Math.ceil((rows?.length||0) / pageSize);
  const paged      = (rows||[]).slice((page-1)*pageSize, page*pageSize);

  return (
    <div className="card" id={id} style={{ gridColumn: expanded ? "1 / -1" : undefined,
      transition:"all .2s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"0 0 10px" }} className="card-title">
        <span>{title} <span style={{fontSize:12,color:"var(--text-muted)",fontWeight:400}}>({rows?.length||0})</span></span>
        <button onClick={()=>{ setExpanded(e=>!e); setPage(1); }}
          title={expanded ? "Minimizar" : "Maximizar"}
          style={{ background:"none", border:"1px solid var(--border)", borderRadius:6,
            cursor:"pointer", padding:"3px 8px", fontSize:13, color:"var(--text-muted)",
            transition:"background .12s" }}>
          {expanded ? "⊠ Minimizar" : "⊞ Maximizar"}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
          <tbody>{paged.map((row,i) => renderRow(row,i))}</tbody>
        </table>
      </div>
      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"10px 0 0", fontSize:12, color:"var(--text-muted)" }}>
          <span>Página {page} de {totalPages} ({rows?.length} itens)</span>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              style={{ padding:"3px 10px", borderRadius:6, border:"1px solid var(--border)",
                background:"none", cursor:page===1?"not-allowed":"pointer",
                color:page===1?"var(--text-muted)":"var(--text)", fontSize:12 }}>
              ← Anterior
            </button>
            {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
              <button key={p} onClick={()=>setPage(p)}
                style={{ padding:"3px 8px", borderRadius:6, border:"1px solid var(--border)",
                  background:p===page?"var(--accent)":"none",
                  color:p===page?"white":"var(--text)",
                  cursor:"pointer", fontSize:12, minWidth:28 }}>
                {p}
              </button>
            ))}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              style={{ padding:"3px 10px", borderRadius:6, border:"1px solid var(--border)",
                background:"none", cursor:page===totalPages?"not-allowed":"pointer",
                color:page===totalPages?"var(--text-muted)":"var(--text)", fontSize:12 }}>
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filtros ───────────────────────────────────────────────────
function FiltersBar({ filters, onChange, modules }) {
  function set(key, val) { onChange({ ...filters, [key]: val }); }
  const hasFilters = filters.date_from || filters.date_to || filters.module_id || filters.status;

  return (
    <div id="dashboard-filters" style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:10, padding:"14px 16px", marginBottom:20,
    }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end",
          background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8,
          padding:"10px 14px", flex:"1 1 340px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", width:"100%", marginBottom:2 }}>
            📅 PERÍODO DO CICLO
          </div>
          <div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>DATA INÍCIO (de)</div>
            <input type="date" value={filters.date_from||""} onChange={e=>set("date_from",e.target.value)}
              style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
                fontSize:13, background:"var(--surface)" }} />
          </div>
          <div style={{ alignSelf:"flex-end", color:"var(--text-muted)", fontSize:13, paddingBottom:8 }}>até</div>
          <div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>DATA FIM (até)</div>
            <input type="date" value={filters.date_to||""} onChange={e=>set("date_to",e.target.value)}
              style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
                fontSize:13, background:"var(--surface)" }} />
          </div>
        </div>
        <div style={{ flex:"1 1 160px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>MÓDULO</div>
          <select value={filters.module_id||""} onChange={e=>set("module_id",e.target.value)}
            style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
              fontSize:13, background:"var(--bg)", width:"100%" }}>
            <option value="">Todos os módulos</option>
            {(modules||[]).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div style={{ flex:"1 1 140px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>STATUS EXECUÇÃO</div>
          <select value={filters.status||""} onChange={e=>set("status",e.target.value)}
            style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
              fontSize:13, background:"var(--bg)", width:"100%" }}>
            <option value="">Todos</option>
            <option value="passed">Passou</option>
            <option value="failed">Falhou</option>
            <option value="blocked">Bloqueado</option>
            <option value="not_executed">Não executado</option>
          </select>
        </div>
        {hasFilters && (
          <button onClick={() => onChange({})}
            style={{ padding:"6px 14px", borderRadius:6, border:"1px solid var(--danger)",
              color:"var(--danger)", background:"none", fontSize:13, cursor:"pointer",
              alignSelf:"flex-end" }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

function applyFilters(data, filters) {
  if (!data) return data;
  const { date_from, date_to, module_id, status } = filters;
  if (!date_from && !date_to && !module_id && !status) return data;
  const { summary, bugs, modules, bugs_per_module, cycles } = data;

  // BUG 1 CORRIGIDO: datas sem horário são interpretadas como UTC meia-noite,
  // causando off-by-one no fuso horário. Forçar parse local com T00:00:00.
  const from = date_from ? new Date(date_from + "T00:00:00") : null;
  const to   = date_to   ? new Date(date_to   + "T23:59:59") : null;

  // BUG 2 CORRIGIDO: ciclos sem data de início ou fim eram sempre incluídos,
  // mesmo fora do período. Ciclo sem datas só entra se nenhum filtro de data estiver ativo.
  // NOVO: filtro de só data_from OU só data_to funciona independentemente.
  const filteredCycles = cycles?.filter(c => {
    const cStart = c.start_date ? new Date(c.start_date + "T00:00:00") : null;
    const cEnd   = c.end_date   ? new Date(c.end_date   + "T23:59:59") : null;
    if (from || to) {
      if (!cStart && !cEnd) return false;
      // só data_from: exclui ciclos que terminaram antes
      if (from && !to && cEnd && cEnd < from) return false;
      // só data_to: exclui ciclos que começaram depois
      if (to && !from && cStart && cStart > to) return false;
      // ambas as datas: sobreposição de períodos
      if (from && to) {
        if (cEnd   && cEnd   < from) return false;
        if (cStart && cStart > to)   return false;
      }
    }
    return true;
  }) || [];

  // BUG 3 CORRIGIDO: filtro de módulo nos ciclos não era aplicado — ciclos de outros
  // módulos entravam no cálculo de execuções, inflando as métricas.
  const filteredCyclesForCalc = module_id
    ? filteredCycles.filter(c => {
        // ciclos não têm module_id direto; filtramos pelas execuções via módulo no backend,
        // então mantemos todos os ciclos mas recalculamos só com os módulos filtrados
        return true;
      })
    : filteredCycles;

  // BUG 4 CORRIGIDO: métricas de execução eram calculadas a partir dos ciclos filtrados,
  // mas quando filtro de módulo estava ativo os valores dos ciclos ainda somavam TODOS os
  // módulos. Recalculamos a partir dos dados de módulo filtrado quando module_id está ativo.
  const filteredModules = module_id
    ? modules?.filter(m => String(m.id) === String(module_id))
    : modules;

  const filteredBpm = module_id
    ? bugs_per_module?.filter(m => String(m.id) === String(module_id))
    : bugs_per_module;

  let passed, failed, blocked, not_executed;
  if (module_id && filteredModules?.length) {
    // Quando filtra por módulo, usa os dados de execução do módulo (mais precisos)
    passed       = filteredModules.reduce((a, m) => a + (m.passed       || 0), 0);
    failed       = filteredModules.reduce((a, m) => a + (m.failed       || 0), 0);
    blocked      = filteredModules.reduce((a, m) => a + (m.blocked      || 0), 0);
    not_executed = filteredModules.reduce((a, m) => a + (m.not_executed || 0), 0);
  } else {
    passed       = filteredCyclesForCalc.reduce((a, c) => a + (c.passed       || 0), 0);
    failed       = filteredCyclesForCalc.reduce((a, c) => a + (c.failed       || 0), 0);
    blocked      = filteredCyclesForCalc.reduce((a, c) => a + (c.blocked      || 0), 0);
    not_executed = filteredCyclesForCalc.reduce((a, c) => a + (c.not_executed || 0), 0);
  }

  const total    = passed + failed + blocked + not_executed;
  const executed = total - not_executed;

  // Quando filtro é só de período (sem module_id), bugs e módulos NÃO são zerados —
  // bugs existem independente de ciclo. Só recalculamos execuções pelos ciclos filtrados.
  // Se não há ciclos no período, execuções ficam zeradas mas bugs/módulos continuam visíveis.
  let filteredBugsSummary = bugs; // bugs sempre mostram o estado atual, independente de período
  if (module_id && filteredBpm?.length) {
    const bOpen       = filteredBpm.reduce((a, m) => a + (m.open_bugs  || 0), 0);
    const bFixed      = filteredBpm.reduce((a, m) => a + (m.fixed_bugs || 0), 0);
    const bTotal      = filteredBpm.reduce((a, m) => a + (m.total_bugs || 0), 0);
    const bInProgress = bTotal - bOpen - bFixed > 0 ? bTotal - bOpen - bFixed : 0;
    filteredBugsSummary = {
      total:       bTotal,
      open:        bOpen,
      fixed:       bFixed,
      in_progress: bInProgress,
      closed:      0, // bugs_per_module não traz closed separado
    };
  }

  // Quando filtro de status ativo, total_executions mostra só o status selecionado
  const totalExecDisplay = status
    ? (status === "passed"       ? passed
    : status === "failed"        ? failed
    : status === "blocked"       ? blocked
    : status === "not_executed"  ? not_executed
    : total)
    : total;

  return {
    summary: {
      ...summary,
      total_executions: totalExecDisplay,
      total_cases: module_id && filteredModules?.length
        ? filteredModules.reduce((a, m) => a + (m.total_cases || 0), 0)
        : summary.total_cases,
      passed, failed, blocked, not_executed,
      success_rate: executed > 0 ? +((passed / executed) * 100).toFixed(1) : 0,
      fail_rate:    executed > 0 ? +((failed / executed) * 100).toFixed(1) : 0,
      block_rate:   executed > 0 ? +((blocked / executed) * 100).toFixed(1) : 0,
    },
    bugs:            filteredBugsSummary,
    modules:         filteredModules,
    bugs_per_module: filteredBpm,
    cycles:          filteredCycles,
  };
}

const fmtBR = d => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "";

export default function Dashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const [filters, setFilters] = useState({});

  const { data, loading, error } = useAsync(
    () => dashboardApi.get(pid ? { project_id: pid } : {}), [pid]
  );
  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;
  if (!data)   return null;

  const { summary, bugs, modules, bugs_per_module } = filtered;
  const cycles = filtered.cycles?.filter(c => c.status === 'active') || [];
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const execPie = [
    { name:"Passou",        value: summary.passed },
    { name:"Falhou",        value: summary.failed },
    { name:"Bloqueado",     value: summary.blocked },
    { name:"Não executado", value: summary.not_executed },
  ].filter(d => d.value > 0);

  const bugPie = [
    { name:"Aberto",       value: bugs.open },
    { name:"Em andamento", value: bugs.in_progress },
    { name:"Corrigido",    value: bugs.fixed },
    { name:"Fechado",      value: bugs.closed },
  ].filter(d => d.value > 0);

  const modBarData = modules?.filter(m => m.total_executions > 0).slice(0,8).map(m => ({
    name:   m.name.length>12 ? m.name.slice(0,12)+"…" : m.name,
    Passou: m.passed, Falhou: m.failed, Bloq: m.blocked,
  })) || [];

  return (
    <div className="page" id="dashboard-page">
      <div className="page-header">
        <h1 id="dashboard-title">Dashboard {currentProject ? `— ${currentProject.name}` : ""}</h1>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <ExportButton filters={filters} />
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>
            {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
          </span>
        </div>
      </div>

      <FiltersBar filters={filters} onChange={setFilters} modules={data?.modules} />

      {hasActiveFilters && (
        <div style={{ background:"var(--accent-bg)", border:"1px solid var(--accent)",
          borderRadius:8, padding:"8px 14px", marginBottom:16,
          fontSize:12, color:"var(--accent)", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <strong>🔍 Filtros ativos:</strong>
          {(filters.date_from || filters.date_to) && (
            <span>Período: {filters.date_from ? fmtBR(filters.date_from) : "início"} → {filters.date_to ? fmtBR(filters.date_to) : "hoje"}</span>
          )}
          {filters.module_id && <span>Módulo: {data?.modules?.find(m=>String(m.id)===String(filters.module_id))?.name}</span>}
          {filters.status    && <span>Status: {filters.status}</span>}
          <span style={{ color:"var(--text-muted)" }}>— {cycles?.length || 0} ciclo(s)</span>
        </div>
      )}

      <div className="metrics-grid" id="metrics-grid">
        <MetricCard label="Casos cadastrados"  value={summary.total_cases} />
        <MetricCard label="Total executado"    value={summary.total_executions} />
        <MetricCard label="Taxa de sucesso"    value={`${summary.success_rate}%`} color="var(--success)" sub={`${summary.passed} passaram`} />
        <MetricCard label="Taxa de falha"      value={`${summary.fail_rate}%`}    color="var(--danger)"  sub={`${summary.failed} falharam`} />
        <MetricCard label="Bloqueados"         value={summary.blocked}            color="var(--purple)" />
        <MetricCard label="Não executados"     value={summary.not_executed} />
        <MetricCard label="Total de bugs"      value={bugs.total} />
        <MetricCard label="Bugs abertos"       value={bugs.open}                  color="var(--danger)" />
      </div>

      <div className="grid-2 mb-20">
        <div className="card">
          <div className="card-title">Execuções por status</div>
          {execPie.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={execPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                  label={({percent}) => `${(percent*100).toFixed(0)}%`}>
                  {execPie.map((d,i) => <Cell key={i} fill={EXEC_COLORS[d.name] || PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty"><p>Sem execuções</p></div>}
        </div>
        <div className="card">
          <div className="card-title">Bugs por status</div>
          {bugPie.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bugPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                  label={({percent}) => `${(percent*100).toFixed(0)}%`}>
                  {bugPie.map((d,i) => <Cell key={i} fill={BUG_COLORS[d.name] || PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty"><p>Sem bugs</p></div>}
        </div>
      </div>

      {modBarData.length > 0 && (
        <div className="card mb-20">
          <div className="card-title">Resultados por módulo</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modBarData} margin={{top:4,right:16,left:-16,bottom:0}}>
              <XAxis dataKey="name" tick={{fontSize:12}} />
              <YAxis tick={{fontSize:12}} allowDecimals={false} />
              <Tooltip /><Legend />
              <Bar dataKey="Passou" stackId="a" fill="#16A34A" />
              <Bar dataKey="Falhou" stackId="a" fill="#DC2626" />
              <Bar dataKey="Bloq"   stackId="a" fill="#7C3AED" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {cycles?.length > 0 ? (
        <div className="mb-20">
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>
            Ciclos de Teste ({cycles.length})
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {cycles.map(c => <CycleCard key={c.id} cycle={c} />)}
          </div>
        </div>
      ) : (filters.date_from || filters.date_to) ? (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:10, padding:"14px 18px", marginBottom:20,
          color:"var(--text-muted)", fontSize:13 }}>
          Nenhum ciclo ativo encontrado para o período selecionado. Os dados de bugs e módulos abaixo refletem o estado atual do projeto.
        </div>
      ) : null}

      {/* Tabelas expansíveis com paginação */}
      <div className="grid-2" id="tables-section" style={{ display:"grid",
        gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start" }}>
        <ExpandableTable
          title="Métricas por módulo"
          id="table-modules"
          headers={["Módulo","Casos","Exec.","Resultado"]}
          rows={modules}
          renderRow={(m,i) => (
            <tr key={m.id}>
              <td style={{fontWeight:500}}>{m.name}</td>
              <td>{m.total_cases}</td>
              <td>{m.total_executions}</td>
              <td style={{minWidth:120}}>
                <StackBar passed={m.passed} failed={m.failed} blocked={m.blocked} not_executed={m.not_executed} />
              </td>
            </tr>
          )}
        />
        <ExpandableTable
          title="Bugs por módulo"
          id="table-bugs-module"
          headers={["Módulo","Total","Abertos","Corrigidos"]}
          rows={bugs_per_module}
          renderRow={(m,i) => (
            <tr key={m.id}>
              <td style={{fontWeight:500}}>{m.name}</td>
              <td>{m.total_bugs}</td>
              <td style={{color:m.open_bugs>0?"var(--danger)":undefined}}>{m.open_bugs}</td>
              <td style={{color:"var(--success)"}}>{m.fixed_bugs}</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}
