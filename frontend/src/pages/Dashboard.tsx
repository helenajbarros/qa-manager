import { useState, useMemo, CSSProperties } from "react";
import { useAsync }      from "../hooks/useAsync.js";
import { dashboardApi, cyclesApi }  from "../services/resources.js";
import { useProject }    from "../context/ProjectContext.js";
import { Loading, ErrorMsg } from "../components/UI.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { ExportButton } from "../components/ExportButton.js";
import type { DashboardData, Cycle } from "../types/index.js";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  id?: string;
}

interface StackBarProps {
  passed?: number;
  failed?: number;
  blocked?: number;
  not_executed?: number;
}

interface CycleWithStats extends Cycle {
  total_executions?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  not_executed?: number;
  version?: string;
  test_types?: string;
  module_name?: string;
}

interface CycleCardProps {
  cycle: CycleWithStats;
  activeStatus?: string | null;
}

const PIE_COLORS  = ["#16A34A","#DC2626","#7C3AED","#9CA3AF"];
const EXEC_COLORS = { "Passou":"#16A34A", "Falhou":"#DC2626", "Bloqueado":"#7C3AED", "Não executado":"#9CA3AF" };
const BUG_COLORS  = { "Aberto":"#DC2626", "Em andamento":"#F59E0B", "Corrigido":"#16A34A", "Fechado":"#9CA3AF" };
const PAGE_SIZE  = 5;

function MetricCard({ label, value, sub, color, id }: MetricCardProps) {
  return (
    <div className="metric-card" id={id}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={color?{color}:{}}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function StackBar({ passed=0, failed=0, blocked=0, not_executed=0 }: StackBarProps) {
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

function CycleCard({ cycle, activeStatus }: CycleCardProps) {
  // Quando filtro de status ativo, mostra só o valor do status selecionado
  const displayCycle = activeStatus ? {
    ...cycle,
    passed:       activeStatus === "passed"       ? (cycle.passed       || 0) : 0,
    failed:       activeStatus === "failed"        ? (cycle.failed       || 0) : 0,
    blocked:      activeStatus === "blocked"       ? (cycle.blocked      || 0) : 0,
    not_executed: activeStatus === "not_executed"  ? (cycle.not_executed || 0) : 0,
  } : cycle;
  const exec = activeStatus
    ? (displayCycle.passed + displayCycle.failed + displayCycle.blocked + displayCycle.not_executed)
    : (cycle.total_executions || 0);
  // Exclui não executados do denominador — só conta o que foi efetivamente testado
  const executed = exec - (displayCycle.not_executed || 0);
  const pct  = executed > 0 ? Math.round((displayCycle.passed / executed) * 100) : 0;
  const types   = cycle.test_types ? cycle.test_types.split(",").filter(Boolean) : [];
  const fmtDate = (d?: string | null) => d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}) : null;
  const startD  = fmtDate(cycle.start_date);
  const endD    = fmtDate(cycle.end_date);
  let duration  = null;
  if (cycle.start_date && cycle.end_date) {
    const days = Math.round((new Date(cycle.end_date! + "T12:00:00").getTime()-new Date(cycle.start_date! + "T12:00:00").getTime())/(1000*60*60*24));
    duration = `${days} dias`;
  }
  return (
    <div className="card" style={{ marginBottom:0 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14 }}>{cycle.name}</div>
          {cycle.version && (
            <div style={{position:"relative",display:"inline-block"}}>
              <style>{`.vw-${cycle.id}:hover .vt-${cycle.id}{display:block!important}`}</style>
              <div className={`vw-${cycle.id}`} style={{display:"inline-block"}}>
                <div style={{fontSize:11,color:"var(--accent)",marginTop:2,cursor:"help"}}>v{cycle.version} ℹ️</div>
                <div className={`vt-${cycle.id}`} style={{display:"none",position:"absolute",left:0,top:"100%",
                  background:"#1E293B",color:"white",borderRadius:8,padding:"12px 16px",
                  fontSize:12,whiteSpace:"nowrap",zIndex:200,boxShadow:"0 4px 16px rgba(0,0,0,.3)",minWidth:220,marginTop:4}}>
                  <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>📦 v{cycle.version}</div>
                  <div style={{marginBottom:4}}>✅ Sucesso: <strong>{executed > 0 ? Math.round((displayCycle.passed/executed)*100) : 0}%</strong></div>
                  <div style={{marginBottom:4}}>❌ Falha: <strong>{executed > 0 ? Math.round((displayCycle.failed/executed)*100) : 0}%</strong></div>
                  <div style={{marginBottom:4}}>🔢 Executados: <strong>{executed}</strong></div>
                  <div style={{marginBottom:4}}>⏳ Não executados: <strong>{displayCycle.not_executed||0}</strong></div>
                  {(cycle.bugs as any)?.total > 0 && <div>🐛 Bugs: <strong>{(cycle.bugs as any).total}</strong> ({(cycle.bugs as any).open} abertos)</div>}
                </div>
              </div>
            </div>
          )}
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
      {(() => {
        const barColor   = pct >= 70 ? "#16A34A" : pct >= 40 ? "#D97706" : executed > 0 ? "#DC2626" : "var(--border)";
        const tooltipMsg = executed === 0
          ? "Nenhum caso executado ainda."
          : pct >= 70
          ? `✅ Boa qualidade — ${pct}% dos casos executados passaram.`
          : pct >= 40
          ? `⚠ Atenção — ${pct}% passaram. Taxa entre 40% e 69%.`
          : `🔴 Crítico — apenas ${pct}% passaram. Taxa abaixo de 40%.`;
        const notExec = displayCycle.not_executed||0;
        const fullMsg = `${tooltipMsg}${notExec > 0 ? ` (${notExec} ainda não executado${notExec>1?"s":""})` : ""}`;
        return (
          <div title={fullMsg} style={{cursor:"help"}}>
            <StackBar passed={displayCycle.passed} failed={displayCycle.failed} blocked={displayCycle.blocked} not_executed={displayCycle.not_executed} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:12 }}>
              <div style={{ display:"flex", gap:12 }}>
                <span style={{ color:"#16A34A" }}>✓ {displayCycle.passed||0}</span>
                <span style={{ color:"#DC2626" }}>✗ {displayCycle.failed||0}</span>
                <span style={{ color:"#7C3AED" }}>⊘ {displayCycle.blocked||0}</span>
                <span style={{ color:"var(--text-muted)" }}>— {displayCycle.not_executed||0}</span>
              </div>
              <span style={{ fontWeight:600, color: barColor }}>
                {pct}%
              </span>
            </div>
          </div>
        );
      })()}
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
function FiltersBar({ filters, onChange, modules, cycles = [] }) {
  function set(key, val) { onChange({ ...filters, [key]: val }); }
  const hasFilters = filters.date_from || filters.date_to || filters.module_id || filters.status || filters.cycle_id || filters.period;

  // Valida período invertido: início depois do fim
  const dateError = filters.date_from && filters.date_to && filters.date_from > filters.date_to
    ? "A data de início não pode ser maior que a data fim."
    : null;

  function setDate(key, val) {
    const next = { ...filters, [key]: val, period: "custom" };
    if (next.date_from && next.date_to && next.date_from > next.date_to) {
      if (key === "date_from") next.date_to = "";
      else next.date_from = "";
    }
    onChange(next);
  }

  // Atalhos de período
  function setPeriod(period) {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    let from = "", to = fmt(today);
    if (period === "week") {
      const d = new Date(today); d.setDate(today.getDate() - 7);
      from = fmt(d);
    } else if (period === "month") {
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (period === "lastmonth") {
      from = fmt(new Date(today.getFullYear(), today.getMonth()-1, 1));
      to   = fmt(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (period === "3months") {
      const d = new Date(today); d.setMonth(today.getMonth()-3);
      from = fmt(d);
    } else if (period === "year") {
      from = fmt(new Date(today.getFullYear(), 0, 1));
    } else if (period === "custom") {
      onChange({ ...filters, period: "custom" });
      return;
    }
    onChange({ ...filters, period, date_from: from, date_to: to });
  }

  // Ao selecionar um ciclo, preenche automaticamente as datas de início e fim
  function setCycle(cycleId) {
    if (!cycleId) {
      onChange({ ...filters, cycle_id: "" });
      return;
    }
    if (cycleId === "no_cycle") {
      onChange({ ...filters, cycle_id: "no_cycle" });
      return;
    }
    if (cycleId?.startsWith("version:")) {
      onChange({ ...filters, cycle_id: cycleId });
      return;
    }
    const cycle = cycles.find(c => String(c.id) === String(cycleId));
    onChange({
      ...filters,
      cycle_id:  cycleId,
      period:    "custom",
      date_from: cycle?.start_date ? cycle.start_date.slice(0,10) : filters.date_from,
      date_to:   cycle?.end_date   ? cycle.end_date.slice(0,10)   : filters.date_to,
    });
  }

  const PERIODS = [
    { value:"week",      label:"Esta semana" },
    { value:"month",     label:"Este mês" },
    { value:"lastmonth", label:"Mês anterior" },
    { value:"3months",   label:"Últimos 3 meses" },
    { value:"year",      label:"Este ano" },
    { value:"custom",    label:"Personalizado" },
  ];

  return (
    <div id="dashboard-filters" style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:10, padding:"14px 16px", marginBottom:20,
    }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end",
          background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8,
          padding:"10px 14px", flex:"1 1 340px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--accent)", width:"100%", marginBottom:4 }}>
            📅 PERÍODO
          </div>
          {/* Atalhos de período */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, width:"100%", marginBottom:4 }}>
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                style={{ padding:"4px 10px", borderRadius:20, fontSize:11, cursor:"pointer",
                  border:"1px solid var(--border)",
                  background: filters.period === p.value ? "var(--accent)" : "var(--surface)",
                  color: filters.period === p.value ? "#fff" : "var(--text-muted)",
                  fontWeight: filters.period === p.value ? 600 : 400 }}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Campos de data — só mostra quando Personalizado ou ciclo selecionado */}
          {(filters.period === "custom" || filters.cycle_id) && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>DE</div>
                <input type="date" value={filters.date_from||""} onChange={e=>setDate("date_from",e.target.value)}
                  max={filters.date_to||undefined}
                  style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
                    fontSize:13, background:"var(--surface)" }} />
              </div>
              <div style={{ alignSelf:"flex-end", color:"var(--text-muted)", fontSize:13, paddingBottom:8 }}>até</div>
              <div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>ATÉ</div>
                <input type="date" value={filters.date_to||""} onChange={e=>setDate("date_to",e.target.value)}
                  min={filters.date_from||undefined}
                  style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
                    fontSize:13, background:"var(--surface)" }} />
              </div>
            </div>
          )}
          {dateError && (
            <div style={{ width:"100%", fontSize:11, color:"var(--danger)", marginTop:4 }}>
              ⚠ {dateError}
            </div>
          )}
        </div>
        <div style={{ flex:"1 1 160px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)", marginBottom:4 }}>CICLO</div>
          <select value={filters.cycle_id||""} onChange={e=>setCycle(e.target.value)}
            style={{ padding:"6px 10px", borderRadius:6, border:"1px solid var(--border)",
              fontSize:13, background:"var(--surface)", width:"100%" }}>
            <option value="">Todos os ciclos</option>
            <option value="no_cycle">📋 Bugs sem vínculo com ciclo</option>
            {(() => {
              const versions = [...new Set(cycles.filter(c=>c.version).map(c=>c.version))].sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
              if (!versions.length) return null;
              return <optgroup label="── Por versão ──">
                {versions.map(v => <option key={v} value={`version:${v}`}>📦 v{v}</option>)}
              </optgroup>;
            })()}
            {cycles.filter(c=>c.status==="active").length > 0 && <optgroup label="── Ativos ──">
              {cycles.filter(c=>c.status==="active").map(c => {
                const date = c.start_date ? new Date(c.start_date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "";
                return <option key={c.id} value={c.id}>{c.name}{c.version?` (v${c.version})`:""}{ date ? " — "+date : ""}</option>;
              })}
            </optgroup>}
            {cycles.filter(c=>c.status!=="active").length > 0 && <optgroup label="── Encerrados (últimos 5) ──">
              {cycles.filter(c=>c.status!=="active")
                .sort((a,b)=>new Date(b.start_date||0)-new Date(a.start_date||0))
                .slice(0,5)
                .map(c => {
                  const date = c.start_date ? new Date(c.start_date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "";
                  return <option key={c.id} value={c.id}>{c.name}{c.version?` (v${c.version})`:""}{ date ? " — "+date : ""}</option>;
                })}
            </optgroup>}
          </select>
        </div>
        <div style={{ flex:"1 1 180px" }}>
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

const ENV_LABELS: Record<string,string> = {
  production: "Produção",
  homologation: "Homologação",
  staging: "Staging",
  development: "Desenvolvimento",
};
const ENV_COLORS: Record<string,string> = {
  production: "var(--danger)",
  homologation: "#F59E0B",
  staging: "#8B5CF6",
  development: "#2563EB",
};

function applyFilters(data, filters) {
  if (!data) return data;
  const { date_from, date_to, module_id, status, cycle_id } = filters;
  if (!date_from && !date_to && !module_id && !status && !cycle_id) return data;
  // "no_cycle" é tratado pelo backend — o frontend só passa os dados como vieram
  const { summary, bugs, modules, bugs_per_module, cycles } = data;

  // BUG 1 CORRIGIDO: datas sem horário são interpretadas como UTC meia-noite,
  // causando off-by-one no fuso horário. Forçar parse local com T00:00:00.
  const from = date_from ? new Date(date_from + "T00:00:00") : null;
  const to   = date_to   ? new Date(date_to   + "T23:59:59") : null;

  // Se ciclo específico: backend já filtrou tudo, só filtra a lista de ciclos
  const filteredCycles = cycles?.filter(c => {
    if (cycle_id) return String(c.id) === String(cycle_id);

    const cStart = c.start_date ? new Date(c.start_date + "T00:00:00") : null;
    const cEnd   = c.end_date   ? new Date(c.end_date   + "T23:59:59") : null;
    if (from || to) {
      if (!cStart && !cEnd) return false;
      if (from && !to && cEnd && cEnd < from) return false;
      if (to && !from && cStart && cStart > to) return false;
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
  // Quando cycle_id ativo: backend já filtrou modules e bugs_per_module por ciclo
  // Quando module_id ativo: filtra no frontend
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

  // Bugs: sempre mostra bugs globais do projeto (incluindo exploratórios sem ciclo)
  // Quando ciclo específico, soma bugs do ciclo + bugs sem vínculo nenhum
  let filteredBugsSummary = bugs;
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

  // Quando filtro de status ativo, isola apenas o valor do status selecionado
  // para que métricas, gráfico de execuções e total fiquem consistentes entre si.
  let displayPassed = passed, displayFailed = failed;
  let displayBlocked = blocked, displayNotExec = not_executed;
  let displayTotal = total;
  if (status) {
    displayPassed   = status === "passed"       ? passed       : 0;
    displayFailed   = status === "failed"        ? failed       : 0;
    displayBlocked  = status === "blocked"       ? blocked      : 0;
    displayNotExec  = status === "not_executed"  ? not_executed : 0;
    displayTotal    = displayPassed + displayFailed + displayBlocked + displayNotExec;
  }
  const displayExecuted = displayTotal - displayNotExec;

  // Bugs: quando filtro é só de status de execução (sem module_id),
  // mantém bugs globais pois bugs não têm status de execução vinculado diretamente.
  // Quando module_id ativo, já foi recalculado acima em filteredBugsSummary.

  return {
    summary: {
      ...summary,
      total_executions: displayTotal,
      total_cases: module_id && filteredModules?.length
        ? filteredModules.reduce((a, m) => a + (m.total_cases || 0), 0)
        : summary.total_cases,
      passed:       displayPassed,
      failed:       displayFailed,
      blocked:      displayBlocked,
      not_executed: displayNotExec,
      success_rate: displayExecuted > 0 ? +((displayPassed   / displayExecuted) * 100).toFixed(1) : 0,
      fail_rate:    displayExecuted > 0 ? +((displayFailed   / displayExecuted) * 100).toFixed(1) : 0,
      block_rate:   displayExecuted > 0 ? +((displayBlocked  / displayExecuted) * 100).toFixed(1) : 0,
    },
    bugs:                filteredBugsSummary,
    modules:             filteredModules,
    bugs_per_module:     filteredBpm,
    cycles:              filteredCycles,
    bugs_by_environment: data.bugs_by_environment,
    // Passa o status ativo para o componente poder filtrar modBarData
    activeStatus:        status || null,
  };
}

const fmtBR = d => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "";

export default function Dashboard() {
  const { currentProject } = useProject();
  const pid = currentProject?.id;
  const [filters, setFilters] = useState({});

  const { data, loading, error } = useAsync(
    () => {
      const params = pid ? { project_id: pid } : {};
      // Quando ciclo específico selecionado, passa cycle_id para o backend
      if (filters.cycle_id) params.cycle_id = filters.cycle_id; // inclui "no_cycle"
      // Passa filtros de data para o backend filtrar execuções no servidor
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to)   params.date_to   = filters.date_to;
      return dashboardApi.get(params);
    },
    [pid, filters.cycle_id, filters.date_from, filters.date_to]
  );

  // Busca ciclos para o filtro de ciclo no seletor
  const { data: cyclesRaw } = useAsync(
    () => cyclesApi.list(pid ? { project_id: pid } : {}), [pid]
  );
  const filterCycles = ((cyclesRaw as any)?.data ?? cyclesRaw ?? []) as CycleWithStats[];

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;
  if (!data)   return null;

  const { summary, bugs, modules, bugs_per_module, bugs_by_environment } = filtered;
  const cycles = filtered.cycles?.filter(c => c.status === 'active') || [];
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const activeStatus = filtered.activeStatus;

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

  // modBarData respeita filtro de status: mostra só a coluna do status ativo
  // e exclui módulos com valor zero no status selecionado
  const modBarData = (modules || []).filter(m => {
    if (!activeStatus) return m.total_executions > 0;
    if (activeStatus === "passed")       return (m.passed       || 0) > 0;
    if (activeStatus === "failed")       return (m.failed       || 0) > 0;
    if (activeStatus === "blocked")      return (m.blocked      || 0) > 0;
    if (activeStatus === "not_executed") return (m.not_executed || 0) > 0;
    return m.total_executions > 0;
  }).slice(0,8).map(m => {
    const n = m.name.length > 12 ? m.name.slice(0,12)+"…" : m.name;
    if (activeStatus === "passed")       return { name: n, Passou: m.passed       || 0 };
    if (activeStatus === "failed")       return { name: n, Falhou: m.failed       || 0 };
    if (activeStatus === "blocked")      return { name: n, Bloq:   m.blocked      || 0 };
    if (activeStatus === "not_executed") return { name: n, "Não exec": m.not_executed || 0 };
    return { name: n, Passou: m.passed || 0, Falhou: m.failed || 0, Bloq: m.blocked || 0 };
  });

  // Tendência por ciclo — ordena por data e calcula taxa de sucesso
  const allCycles = data?.cycles || [];
  const trendData = [...allCycles]
    .filter(c => c.total_executions > 0)
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-10)
    .map((c, i, arr) => {
      const exec = c.total_executions - (c.not_executed || 0);
      const successRate = exec > 0 ? +((c.passed / exec) * 100).toFixed(1) : 0;
      const failRate    = exec > 0 ? +((c.failed / exec) * 100).toFixed(1) : 0;
      const date = c.start_date
        ? new Date(c.start_date + "T12:00:00").toLocaleDateString("pt-BR", {day:"2-digit",month:"2-digit"})
        : new Date(c.created_at).toLocaleDateString("pt-BR", {day:"2-digit",month:"2-digit"});
      const label = `${i+1}º — ${c.name.length > 10 ? c.name.slice(0,10)+"…" : c.name} (${date})`;
      return {
        name: label,
        Sucesso: successRate,
        Falha:   failRate,
        _ordem: i + 1,
      };
    });

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

      <FiltersBar filters={filters} onChange={setFilters} modules={data?.modules} cycles={filterCycles} />

      {hasActiveFilters && (
        <div style={{ background:"var(--accent-bg)", border:"1px solid var(--accent)",
          borderRadius:8, padding:"8px 14px", marginBottom:16,
          fontSize:12, color:"var(--accent)", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <strong>🔍 Filtros ativos:</strong>
          {filters.period && filters.period !== "custom" && (
            <span>Período: {["week","month","lastmonth","3months","year"].includes(filters.period) ? {week:"Esta semana",month:"Este mês",lastmonth:"Mês anterior","3months":"Últimos 3 meses",year:"Este ano"}[filters.period] : ""}</span>
          )}
          {(filters.date_from || filters.date_to) && filters.period === "custom" && !filters.cycle_id && (
            <span>Período: {filters.date_from ? fmtBR(filters.date_from) : "início"} → {filters.date_to ? fmtBR(filters.date_to) : "hoje"}</span>
          )}
          {filters.cycle_id && filters.cycle_id !== "no_cycle" && !filters.cycle_id.startsWith("version:") && <span>Ciclo: {filterCycles?.find(c=>String(c.id)===String(filters.cycle_id))?.name}</span>}
          {filters.cycle_id?.startsWith("version:") && <span>Versão: {filters.cycle_id.replace("version:","")}</span>}
          {filters.cycle_id === "no_cycle" && <span>Bugs sem vínculo com ciclo</span>}
          {filters.module_id && <span>Módulo: {data?.modules?.find(m=>String(m.id)===String(filters.module_id))?.name}</span>}
          {filters.status    && <span>Status: {filters.status}</span>}
          <span style={{ color:"var(--text-muted)" }}>— {cycles?.length || 0} ciclo(s)</span>
        </div>
      )}

      <div className="metrics-grid" id="metrics-grid">
        <MetricCard label="Casos cadastrados"  value={summary.total_cases} />
        <MetricCard label="Total executado"    value={summary.total_executions - summary.not_executed} />
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
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    if (percent < 0.05) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return <text x={x} y={y} fill="#333" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="500">{`${(percent*100).toFixed(0)}%`}</text>;
                  }}>
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
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    if (percent < 0.05) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return <text x={x} y={y} fill="#333" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="500">{`${(percent*100).toFixed(0)}%`}</text>;
                  }}>
                  {bugPie.map((d,i) => <Cell key={i} fill={BUG_COLORS[d.name] || PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty"><p>Sem bugs</p></div>}
        </div>
        {bugs_by_environment && bugs_by_environment.length > 0 && (
          <div className="card">
            <div className="card-title">Bugs por ambiente</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={bugs_by_environment.map(e => ({
                    name: ENV_LABELS[e.environment] || e.environment,
                    value: e.total,
                    open: e.open,
                  }))}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value"
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    if (percent < 0.05) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return <text x={x} y={y} fill="#333" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="500">{`${(percent*100).toFixed(0)}%`}</text>;
                  }}>
                  {bugs_by_environment.map((e, i) => (
                    <Cell key={i} fill={e.color || ENV_COLORS[e.environment] || PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const fechados = d.value - d.open;
                    return (
                      <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:8,padding:"10px 14px",fontSize:13,boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}>
                        <div style={{fontWeight:600,marginBottom:6}}>{d.name}</div>
                        <div>🐛 Total: <strong>{d.value}</strong></div>
                        <div style={{color:"#EF4444"}}>🔴 Abertos: <strong>{d.open}</strong></div>
                        <div style={{color:"#10B981"}}>✅ Fechados/Corrigidos: <strong>{fechados}</strong></div>
                      </div>
                    );
                  }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {modBarData.length > 0 && (
        <div className="card mb-20">
          <div className="card-title">Resultados por módulo</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modBarData} margin={{top:4,right:16,left:-16,bottom:0}}>
              <XAxis dataKey="name" tick={{fontSize:12}} />
              <YAxis tick={{fontSize:12}} allowDecimals={false} />
              <Tooltip /><Legend />
              <Bar dataKey="Passou"   stackId="a" fill="#16A34A" />
              <Bar dataKey="Falhou"   stackId="a" fill="#DC2626" />
              <Bar dataKey="Bloq"     stackId="a" fill="#7C3AED" />
              <Bar dataKey="Não exec" stackId="a" fill="#9CA3AF" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {trendData.length >= 2 && (
        <div className="card mb-20">
          <div className="card-title">Tendência de qualidade por ciclo</div>
          <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>
            Taxa de sucesso e falha nos últimos {trendData.length} ciclos executados
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData} margin={{top:16,right:24,left:-16,bottom:40}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{fontSize:10}} angle={-20} textAnchor="end" interval={0} />
              <YAxis tick={{fontSize:11}} unit="%" domain={[0,100]} />
              <Tooltip formatter={(v, name) => [`${v}%`, name]} labelFormatter={(l) => `Ciclo: ${l}`} />
              <Legend verticalAlign="top" />
              <Line type="monotone" dataKey="Sucesso" stroke="#16A34A" strokeWidth={2}
                dot={{r:5,fill:"#16A34A"}} activeDot={{r:7}}
                label={{position:"top",fontSize:10,fill:"#16A34A",formatter:(v)=>`${v}%`}} />
              <Line type="monotone" dataKey="Falha" stroke="#DC2626" strokeWidth={2}
                dot={{r:5,fill:"#DC2626"}} activeDot={{r:7}}
                label={{position:"bottom",fontSize:10,fill:"#DC2626",formatter:(v)=>`${v}%`}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {cycles?.length > 0 ? (
        <div className="mb-20">
          <h2 style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>
            Ciclos de Teste ({cycles.length})
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {cycles.map(c => <CycleCard key={c.id} cycle={c} activeStatus={activeStatus} />)}
          </div>
        </div>
      ) : (filters.date_from || filters.date_to) ? (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:10, padding:"14px 18px", marginBottom:20,
          color:"var(--text-muted)", fontSize:13 }}>
          Nenhum ciclo ativo encontrado para o período selecionado. Os dados de bugs e módulos abaixo refletem o estado atual do projeto.
        </div>
      ) : null}

      {/* Tabelas expansíveis com paginação */}      <div className="grid-2" id="tables-section" style={{ display:"grid",
        gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start" }}>
        <ExpandableTable
          title="Métricas por módulo"
          id="table-modules"
          headers={filters.cycle_id === "no_cycle" ? ["Módulo","Casos","Bugs","Abertos"] : ["Módulo","Casos","Exec.","Resultado"]}
          rows={filters.cycle_id === "no_cycle" ? bugs_per_module : modules}
          renderRow={(m,i) => (
            filters.cycle_id === "no_cycle" ? (
              <tr key={m.id}>
                <td style={{fontWeight:500}}>{m.name}</td>
                <td>{m.total_cases||0}</td>
                <td>{m.total_bugs||0}</td>
                <td style={{color:m.open_bugs>0?"var(--danger)":undefined}}>{m.open_bugs||0}</td>
              </tr>
            ) : (
              <tr key={m.id}>
                <td style={{fontWeight:500}}>{m.name}</td>
                <td>{m.total_cases}</td>
                <td>{m.total_executions||0}</td>
                <td style={{minWidth:120}}>
                  <StackBar passed={m.passed} failed={m.failed} blocked={m.blocked} not_executed={m.not_executed} />
                </td>
              </tr>
            )
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
