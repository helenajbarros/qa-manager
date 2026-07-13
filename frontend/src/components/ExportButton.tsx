import { useState, CSSProperties } from "react";
import { useProject } from "../context/ProjectContext.js";
import { useAuth } from "../context/AuthContext.js";
import { ExportFilters } from "../exports/shared";
import { exportExcel } from "../exports/excel";
import { exportHTML } from "../exports/technical";
import { exportExecutive } from "../exports/qualityGate";
import { exportBugReport } from "../exports/bugReport";
import { exportReleaseNotes } from "../exports/releaseNotes";
import { exportCoverageReport } from "../exports/coverage";
import { exportRegressionReport } from "../exports/regression";
import { exportStatusReport } from "../exports/status";
import { exportMetricsReport } from "../exports/metrics";
import { exportRiskReport } from "../exports/risk";

interface ExportButtonProps {
  style?: CSSProperties;
  filters?: ExportFilters;
}

export function ExportButton({ style, filters }: ExportButtonProps) {
  const { currentProject } = useProject();
  const { isAdmin, isManager } = useAuth();
  const canViewManagementReports = isAdmin || isManager; // Quality Gate e Release Notes são restritos a gestão
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  const hasFilters = filters && Object.values(filters).some(Boolean);

  async function handle(type: string) {
    setLoading(type); setError("");
    try {
      if (type === "xlsx") await exportExcel(currentProject?.name, currentProject?.id, filters);
      if (type === "html") await exportHTML(currentProject?.name, currentProject?.id, filters);
      if (type === "bugs") await exportBugReport(currentProject?.name, currentProject?.id, filters);
      if (type === "executive") await exportExecutive(currentProject?.name, currentProject?.id, filters); // Quality Gate Report
      if (type === "release") await exportReleaseNotes(currentProject?.name, currentProject?.id, filters);
      if (type === "coverage") await exportCoverageReport(currentProject?.name, currentProject?.id, filters);
      if (type === "regression") await exportRegressionReport(currentProject?.name, currentProject?.id, filters);
      if (type === "status") await exportStatusReport(currentProject?.name, currentProject?.id, filters);
      if (type === "metrics") await exportMetricsReport(currentProject?.name, currentProject?.id, filters);
      if (type === "risk") await exportRiskReport(currentProject?.name, currentProject?.id, filters);
    } catch(e) {
      console.error(e);
      setError(e.message || "Erro ao exportar. Tente novamente.");
    } finally { setLoading(null); }
  }

  const [showMenu, setShowMenu] = useState<boolean>(false);

  return (
    <div style={{display:"inline-flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative"}}>
          <button className="btn" onClick={()=>setShowMenu(v=>!v)} disabled={!!loading}
            style={{...style, background:"#1E3A5F", color:"white", border:"none", fontWeight:600}}>
            {loading ? "⏳ Gerando…" : "⬇ Exportar ▾"}
          </button>
          {showMenu && (
            <>
            <div onClick={()=>setShowMenu(false)} style={{position:"fixed",inset:0,zIndex:99,background:"rgba(0,0,0,0.3)"}} />
            <div style={{position:"absolute",right:0,top:"110%",background:"#ffffff",
              border:"1px solid #E5E7EB",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)",
              zIndex:100,minWidth:220,overflow:"hidden"}}>

              {/* Dados */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6"}}>
                Dados
              </div>
              <button onClick={()=>{setShowMenu(false);handle("xlsx");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📊 Excel (.xlsx)
              </button>

              {/* Time de QA */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6",borderTop:"1px solid #F3F4F6"}}>
                👥 Para o Time de QA
              </div>
              <button onClick={()=>{setShowMenu(false);handle("html");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📄 Relatório Técnico (HTML+PDF)
              </button>
              <button onClick={()=>{setShowMenu(false);handle("bugs");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                🐛 Relatório de Defeitos
              </button>

              {/* Gestão / Cliente — visível só para admin/manager */}
              {canViewManagementReports && (
              <>
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6",borderTop:"1px solid #F3F4F6"}}>
                🏢 Para Gestão / Cliente
              </div>
              <button onClick={()=>{setShowMenu(false);handle("executive");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                🎯 Quality Gate Report
              </button>
              <button onClick={()=>{setShowMenu(false);handle("release");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📋 Release Notes de QA
              </button>
              <button onClick={()=>{setShowMenu(false);handle("status");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📅 Daily/Weekly Status
              </button>

              {/* Time de QA — avançado (admin/manager) */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6",borderTop:"1px solid #F3F4F6"}}>
                🔍 Análises (Admin/Gerente)
              </div>
              <button onClick={()=>{setShowMenu(false);handle("coverage");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📈 Relatório de Cobertura
              </button>
              <button onClick={()=>{setShowMenu(false);handle("regression");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                🔄 Relatório de Regressão
              </button>

              {/* Processo */}
              <div style={{padding:"6px 16px 4px",fontSize:10,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #F3F4F6",borderTop:"1px solid #F3F4F6"}}>
                ⚙️ Processo
              </div>
              <button onClick={()=>{setShowMenu(false);handle("metrics");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                📊 Relatório de Métricas
              </button>
              <button onClick={()=>{setShowMenu(false);handle("risk");}}
                onMouseEnter={e=>(e.currentTarget.style.background="#EEF2F7")}
                onMouseLeave={e=>(e.currentTarget.style.background="#ffffff")}
                style={{display:"block",width:"100%",padding:"9px 16px",textAlign:"left",
                  background:"#ffffff",border:"none",cursor:"pointer",fontSize:13,color:"#111827"}}>
                🚨 Relatório de Risco
              </button>
              </>
              )}
            </div>
            </>
          )}
        </div>
        {hasFilters && (
          <span style={{fontSize:11, color:"var(--accent)", background:"var(--accent-bg)",
            padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap"}}>
            🔍 Filtros ativos
          </span>
        )}
      </div>
      {error && <span style={{fontSize:11,color:"var(--danger)"}}>{error}</span>}
    </div>
  );
}


