import { useAsync }      from "../hooks/useAsync.js";
import { dashboardApi }  from "../services/resources.js";
import { useProject }    from "../context/ProjectContext.jsx";
import { Loading, ErrorMsg } from "../components/UI.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ExportButton } from "../components/ExportButton.jsx";

const PIE_COLORS = ["#16A34A","#DC2626","#7C3AED","#9CA3AF"];
const STATUS_COLORS = { passed:"#16A34A", failed:"#DC2626", blocked:"#7C3AED", not_executed:"#E5E7EB" };

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="metric-card">
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

  const startD = fmtDate(cycle.start_date);
  const endD   = fmtDate(cycle.end_date);

  let duration = null;
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

export default function Dashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;

  const { data, loading, error } = useAsync(
    () => dashboardApi.get(pid ? { project_id: pid } : {}),
    [pid]
  );

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;
  if (!data)   return null;

  const { summary, bugs, modules, bugs_per_module, cycles } = data;

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

  const modBarData = modules.filter(m => m.total_executions > 0).slice(0,8).map(m => ({
    name:   m.name.length>12 ? m.name.slice(0,12)+"…" : m.name,
    Passou: m.passed, Falhou: m.failed, Bloq: m.blocked,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard {currentProject ? `— ${currentProject.name}` : ""}</h1>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <ExportButton />
          <span style={{ fontSize:12, color:"var(--text-muted)" }}>
            {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
          </span>
        </div>
      </div>

      {/* Métricas globais */}
      <div className="metrics-grid">
        <MetricCard label="Casos cadastrados"  value={summary.total_cases} />
        <MetricCard label="Total executado"    value={summary.total_executions} />
        <MetricCard label="Taxa de sucesso"    value={`${summary.success_rate}%`} color="var(--success)" sub={`${summary.passed} passaram`} />
        <MetricCard label="Taxa de falha"      value={`${summary.fail_rate}%`}    color="var(--danger)"  sub={`${summary.failed} falharam`} />
        <MetricCard label="Bloqueados"         value={summary.blocked}            color="var(--purple)" />
        <MetricCard label="Não executados"     value={summary.not_executed} />
        <MetricCard label="Total de bugs"      value={bugs.total} />
        <MetricCard label="Bugs abertos"       value={bugs.open}                  color="var(--danger)" />
      </div>

      {/* Gráficos */}
      <div className="grid-2 mb-20">
        <div className="card">
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
        <div className="card">
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

      {/* Ciclos detalhados */}
      {cycles?.length > 0 && (
        <div className="mb-20">
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>
            Ciclos de Teste ({cycles.length})
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {cycles.map(c => <CycleCard key={c.id} cycle={c} />)}
          </div>
        </div>
      )}

      {/* Tabelas */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Métricas por módulo</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Módulo</th><th>Casos</th><th>Exec.</th><th>Resultado</th></tr></thead>
              <tbody>
                {modules.map(m => (
                  <tr key={m.id}>
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
        <div className="card">
          <div className="card-title">Bugs por módulo</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Módulo</th><th>Total</th><th>Abertos</th><th>Corrigidos</th></tr></thead>
              <tbody>
                {bugs_per_module.map(m => (
                  <tr key={m.id}>
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
