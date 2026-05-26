import { useState, useMemo } from "react";
import { useAsync }      from "../hooks/useAsync.js";
import { dashboardApi }  from "../services/resources.js";
import { useProject }    from "../context/ProjectContext.jsx";
import { Loading, ErrorMsg } from "../components/UI.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ExportButton } from "../components/ExportButton.jsx";

const PIE_COLORS = ["#16A34A","#DC2626","#7C3AED","#9CA3AF"];

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
    <div className="card" style={{ marginBottom:0 }} id={`cycle-card-${cycle.id}`}>
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

// ── Filtros ───────────────────────────────────────────────────
function FiltersBar({ filters, onChange, modules }) {
  const currentYear  = new Date().getFullYear();
  const years        = Array.from({length:5}, (_,i) => currentYear - i);
  const months       = [
    {v:"1",l:"Janeiro"},{v:"2",l:"Fevereiro"},{v:"3",l:"Março"},
    {v:"4",l:"Abril"},{v:"5",l:"Maio"},{v:"6",l:"Junho"},
    {v:"7",l:"Julho"},{v:"8",l:"Agosto"},{v:"9",l:"Setembro"},
    {v:"10",l:"Outubro"},{v:"11",l:"Novembro"},{v:"12",l:"Dezembro"},
  ];

  function set(key, val) { onChange({ ...filters, [key]: val }); }

  const hasFilters = filters.year || filters.month || filters.day || filters.module_id || filters.status;

  return (
    <div id="dashboard-filters" style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:10, padding:"14px 16px", marginBottom:20,
      display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end"
    }}>
      <div style={{ flex:"0 0 auto" }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>ANO</div>
        <select id="filter-year" value={filters.year||""} onChange={e=>set("year",e.target.value)}
          style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)", fontSize:13, background:"var(--bg)" }}>
          <option value="">Todos</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ flex:"0 0 auto" }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>MÊS</div>
        <select id="filter-month" value={filters.month||""} onChange={e=>set("month",e.target.value)}
          style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)", fontSize:13, background:"var(--bg)" }}>
          <option value="">Todos</option>
          {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
      </div>
      <div style={{ flex:"0 0 auto" }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>DIA</div>
        <input id="filter-day" type="number" min="1" max="31" value={filters.day||""} placeholder="Dia"
          onChange={e=>set("day",e.target.value)}
          style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)", fontSize:13,
            background:"var(--bg)", width:72 }} />
      </div>
      <div style={{ flex:"1 1 160px" }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>MÓDULO</div>
        <select id="filter-module" value={filters.module_id||""} onChange={e=>set("module_id",e.target.value)}
          style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)", fontSize:13,
            background:"var(--bg)", width:"100%" }}>
          <option value="">Todos os módulos</option>
          {(modules||[]).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ flex:"1 1 140px" }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>STATUS EXECUÇÃO</div>
        <select id="filter-status" value={filters.status||""} onChange={e=>set("status",e.target.value)}
          style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)", fontSize:13,
            background:"var(--bg)", width:"100%" }}>
          <option value="">Todos</option>
          <option value="passed">Passou</option>
          <option value="failed">Falhou</option>
          <option value="blocked">Bloqueado</option>
          <option value="not_executed">Não executado</option>
        </select>
      </div>
      {hasFilters && (
        <button id="btn-clear-filters" onClick={() => onChange({})}
          style={{ padding:"6px 14px", borderRadius:6, border:"1px solid var(--danger)",
            color:"var(--danger)", background:"none", fontSize:13, cursor:"pointer",
            alignSelf:"flex-end" }}>
          ✕ Limpar filtros
        </button>
      )}
    </div>
  );
}

// ── Aplica filtros localmente nos dados ───────────────────────
function applyFilters(data, filters) {
  if (!data) return data;
  const { year, month, day, module_id, status } = filters;
  if (!year && !month && !day && !module_id && !status) return data;

  const { summary, bugs, modules, bugs_per_module, cycles } = data;

  // Filtra ciclos por período
  const filteredCycles = cycles?.filter(c => {
    if (!c.start_date) return true;
    const d = new Date(c.start_date);
    if (year  && d.getFullYear()  !== parseInt(year))  return false;
    if (month && d.getMonth()+1   !== parseInt(month)) return false;
    if (day   && d.getDate()      !== parseInt(day))   return false;
    return true;
  }) || [];

  // Filtra módulos
  const filteredModules = module_id
    ? modules?.filter(m => String(m.id) === String(module_id))
    : modules;

  const filteredBpm = module_id
    ? bugs_per_module?.filter(m => String(m.id) === String(module_id))
    : bugs_per_module;

  // Recalcula summary a partir dos ciclos filtrados
  const passed      = filteredCycles.reduce((a,c) => a+(c.passed||0), 0);
  const failed      = filteredCycles.reduce((a,c) => a+(c.failed||0), 0);
  const blocked     = filteredCycles.reduce((a,c) => a+(c.blocked||0), 0);
  const not_executed= filteredCycles.reduce((a,c) => a+(c.not_executed||0), 0);
  const total       = passed+failed+blocked+not_executed;
  const executed    = total - not_executed;

  // Filtra por status se selecionado
  const filteredSummary = {
    ...summary,
    total_executions: status ? (
      status==="passed"       ? passed :
      status==="failed"       ? failed :
      status==="blocked"      ? blocked :
      status==="not_executed" ? not_executed : total
    ) : total,
    passed, failed, blocked, not_executed,
    success_rate: executed>0 ? +((passed/executed)*100).toFixed(1) : 0,
    fail_rate:    executed>0 ? +((failed/executed)*100).toFixed(1) : 0,
    block_rate:   executed>0 ? +((blocked/executed)*100).toFixed(1) : 0,
  };

  return {
    summary:         filteredSummary,
    bugs:            bugs,
    modules:         filteredModules,
    bugs_per_module: filteredBpm,
    cycles:          filteredCycles,
  };
}

export default function Dashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const [filters, setFilters] = useState({});

  const { data, loading, error } = useAsync(
    () => dashboardApi.get(pid ? { project_id: pid } : {}),
    [pid]
  );

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;
  if (!data)   return null;

  const { summary, bugs, modules, bugs_per_module, cycles } = filtered;

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
          <ExportButton />
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>
            {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
          </span>
        </div>
      </div>

      {/* Filtros */}
      <FiltersBar filters={filters} onChange={setFilters} modules={data?.modules} />

      {/* Badge de filtros ativos */}
      {hasActiveFilters && (
        <div id="active-filters-badge" style={{
          background:"var(--accent-bg)", border:"1px solid var(--accent)",
          borderRadius:8, padding:"8px 14px", marginBottom:16,
          fontSize:12, color:"var(--accent)", display:"flex", gap:8, flexWrap:"wrap"
        }}>
          <strong>🔍 Filtros ativos:</strong>
          {filters.year      && <span>Ano: {filters.year}</span>}
          {filters.month     && <span>Mês: {["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][filters.month]}</span>}
          {filters.day       && <span>Dia: {filters.day}</span>}
          {filters.module_id && <span>Módulo: {data?.modules?.find(m=>String(m.id)===String(filters.module_id))?.name}</span>}
          {filters.status    && <span>Status: {filters.status}</span>}
          <span style={{ color:"var(--text-muted)" }}>
            — {cycles?.length || 0} ciclo(s) encontrado(s)
          </span>
        </div>
      )}

      {/* Métricas globais */}
      <div className="metrics-grid" id="metrics-grid">
        <MetricCard id="metric-cases"        label="Casos cadastrados"  value={summary.total_cases} />
        <MetricCard id="metric-executions"   label="Total executado"    value={summary.total_executions} />
        <MetricCard id="metric-success-rate" label="Taxa de sucesso"    value={`${summary.success_rate}%`} color="var(--success)" sub={`${summary.passed} passaram`} />
        <MetricCard id="metric-fail-rate"    label="Taxa de falha"      value={`${summary.fail_rate}%`}    color="var(--danger)"  sub={`${summary.failed} falharam`} />
        <MetricCard id="metric-blocked"      label="Bloqueados"         value={summary.blocked}            color="var(--purple)" />
        <MetricCard id="metric-not-executed" label="Não executados"     value={summary.not_executed} />
        <MetricCard id="metric-bugs-total"   label="Total de bugs"      value={bugs.total} />
        <MetricCard id="metric-bugs-open"    label="Bugs abertos"       value={bugs.open}                  color="var(--danger)" />
      </div>

      {/* Gráficos */}
      <div className="grid-2 mb-20" id="charts-section">
        <div className="card" id="chart-executions">
          <div className="card-title">Execuções por status</div>
          {execPie.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={execPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                  label={({percent}) => `${(percent*100).toFixed(0)}%`}>
                  {execPie.map((_,i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty"><p>Sem execuções</p></div>}
        </div>
        <div className="card" id="chart-bugs">
          <div className="card-title">Bugs por status</div>
          {bugPie.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bugPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                  label={({percent}) => `${(percent*100).toFixed(0)}%`}>
                  {bugPie.map((_,i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty"><p>Sem bugs</p></div>}
        </div>
      </div>

      {/* Bar por módulo */}
      {modBarData.length > 0 && (
        <div className="card mb-20" id="chart-modules">
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

      {/* Ciclos detalhados */}
      {cycles?.length > 0 ? (
        <div className="mb-20" id="cycles-section">
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>
            Ciclos de Teste ({cycles.length})
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {cycles.map(c => <CycleCard key={c.id} cycle={c} />)}
          </div>
        </div>
      ) : hasActiveFilters ? (
        <div id="no-cycles-filtered" style={{
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:10, padding:24, textAlign:"center",
          color:"var(--text-muted)", marginBottom:20
        }}>
          Nenhum ciclo encontrado para os filtros selecionados.
        </div>
      ) : null}

      {/* Tabelas */}
      <div className="grid-2" id="tables-section">
        <div className="card" id="table-modules">
          <div className="card-title">Métricas por módulo</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Módulo</th><th>Casos</th><th>Exec.</th><th>Resultado</th></tr></thead>
              <tbody>
                {modules?.map(m => (
                  <tr key={m.id} id={`module-row-${m.id}`}>
                    <td style={{fontWeight:500}}>{m.name}</td>
                    <td>{m.total_cases}</td>
                    <td>{m.total_executions}</td>
                    <td style={{minWidth:120}}>
                      <StackBar passed={m.passed} failed={m.failed} blocked={m.blocked} not_executed={m.not_executed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" id="table-bugs-module">
          <div className="card-title">Bugs por módulo</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Módulo</th><th>Total</th><th>Abertos</th><th>Corrigidos</th></tr></thead>
              <tbody>
                {bugs_per_module?.map(m => (
                  <tr key={m.id} id={`bugs-module-row-${m.id}`}>
                    <td style={{fontWeight:500}}>{m.name}</td>
                    <td>{m.total_bugs}</td>
                    <td style={{color:m.open_bugs>0?"var(--danger)":undefined}}>{m.open_bugs}</td>
                    <td style={{color:"var(--success)"}}>{m.fixed_bugs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
