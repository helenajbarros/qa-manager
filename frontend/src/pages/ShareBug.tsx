import { useParams } from "react-router-dom";
import { useAsync }  from "../hooks/useAsync.js";
import type { Bug, Comment } from "../types/index.js";

interface AvatarProps {
  name?: string;
  size?: number;
}

interface SevColors {
  [key: string]: { bg: string; color: string };
}

interface BugData extends Bug {
  activity?: Array<{
    user_name?: string;
    action: string;
    detail?: string;
    created_at: string;
  }>;
  comments?: Comment[];
}

function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}

function Avatar({ name, size = 28 }: AvatarProps) {
  const initials = (name||"?").split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
  const colors   = ["#2563EB","#7C3AED","#059669","#DC2626","#D97706","#0891B2"];
  const color    = colors[(name||"").charCodeAt(0) % colors.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:color+"22",
      color,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.33,fontWeight:500,flexShrink:0}}>
      {initials}
    </div>
  );
}

const SEV_COLORS: SevColors = {
  low:      {bg:"#F3F4F6",color:"#6B7280"},
  medium:   {bg:"#FEF9C3",color:"#854D0E"},
  high:     {bg:"#FEE2E2",color:"#991B1B"},
  critical: {bg:"#FEE2E2",color:"#7F1D1D"},
};
const SEV_LABEL = {low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
const ST_LABEL  = {open:"Aberto",in_progress:"Em andamento",fixed:"Corrigido",closed:"Fechado"};
const ST_COLORS = {
  open:        {bg:"#FEE2E2",color:"#991B1B"},
  in_progress: {bg:"#DBEAFE",color:"#1E40AF"},
  fixed:       {bg:"#DCFCE7",color:"#166534"},
  closed:      {bg:"#F3F4F6",color:"#6B7280"},
};
const ACT_ICONS = {"criou o bug":"🐛","alterou o status":"🔄","alterou o responsável":"👤","editou o bug":"✏"};

const STYLES = `
  *{box-sizing:border-box}
  .share-page{min-height:100vh;background:#F9FAFB;padding:20px 16px;font-family:system-ui,sans-serif}
  .share-container{max-width:860px;margin:0 auto}
  .share-card{background:white;border:1px solid #E5E7EB;border-radius:12px;margin-bottom:14px;overflow:hidden}
  .share-card-header{padding:10px 16px;border-bottom:1px solid #F3F4F6;font-size:11px;font-weight:600;
    color:#6B7280;text-transform:uppercase;letter-spacing:.05em}
  .share-card-body{padding:14px 16px}
  .share-layout{display:grid;grid-template-columns:1fr 260px;gap:14px;align-items:start}
  .share-detail-row{display:flex;justify-content:space-between;align-items:center;
    padding:7px 0;border-bottom:1px solid #F3F4F6;gap:8px;font-size:13px}
  .share-detail-row:last-child{border-bottom:none;padding-bottom:0}
  .share-detail-label{font-size:11px;color:#6B7280;flex-shrink:0}
  .share-badges{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}
  .share-pill{font-size:11px;font-weight:500;padding:3px 10px;border-radius:99px}
  .share-desc ul,.share-desc ol{padding-left:20px;margin:6px 0}
  .share-desc li{margin-bottom:4px;line-height:1.7}
  .share-desc p{margin:0 0 8px}
  .share-desc code{background:#F3F4F6;border:1px solid #E5E7EB;border-radius:4px;
    padding:1px 5px;font-family:monospace;font-size:12px;color:#B5451B}
  .share-step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start}
  .share-step-num{min-width:26px;height:26px;border-radius:50%;background:#EFF6FF;
    color:#1E40AF;display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:600;flex-shrink:0;margin-top:2px}
  .share-act-item{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;
    padding-bottom:10px;border-bottom:1px solid #F3F4F6}
  .share-act-item:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
  .share-footer{text-align:center;margin-top:20px;font-size:12px;color:#9CA3AF;padding-bottom:24px}
  .share-readonly{margin-top:14px;padding:8px 14px;background:#FEF9C3;
    border:1px solid #FDE047;border-radius:8px;font-size:12px;color:#854D0E;
    display:flex;align-items:center;gap:8px;flex-wrap:wrap}

  @media(max-width:640px){
    .share-layout{grid-template-columns:1fr}
    .share-layout .share-sidebar{order:-1}
    .share-page{padding:12px}
    .share-card-body{padding:12px}
    .share-badges{margin-top:8px}
    h1{font-size:17px !important}
  }
`;

export default function ShareBug() {
  const params = useParams();
  const token  = params.token || window.location.pathname.split("/share/")[1]?.split("/")[0];

  const { data: bug, loading, error } = useAsync(async () => {
    const res = await fetch(`${getBase()}/share/${token}`);
    if (!res.ok) throw new Error("Link inválido ou expirado");
    const j = await res.json();
    return j.data ?? j;
  }, [token]);

  if (loading) return (
    <>
      <style>{STYLES}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
        background:"#F9FAFB",fontSize:14,color:"#6B7280"}}>
        Carregando...
      </div>
    </>
  );

  if (error || !bug) return (
    <>
      <style>{STYLES}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",background:"#F9FAFB",gap:12,padding:16}}>
        <div style={{fontSize:40}}>🔒</div>
        <div style={{fontSize:18,fontWeight:600,color:"#111",textAlign:"center"}}>Link inválido ou expirado</div>
        <div style={{fontSize:14,color:"#6B7280",textAlign:"center"}}>Este link não existe ou foi removido.</div>
      </div>
    </>
  );

  const fmtDate = d => d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}) : "—";
  const fmtDateTime = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };
  const sev   = SEV_COLORS[bug.severity] || SEV_COLORS.medium;
  const st    = ST_COLORS[bug.status]    || ST_COLORS.open;
  const steps = bug.steps ? bug.steps.split("\n").filter(Boolean) : [];

  return (
    <>
      <style>{STYLES}</style>
      <div className="share-page">
        <div className="share-container">

          {/* Header */}
          <div className="share-card" style={{padding:"20px 24px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <div style={{fontSize:11,color:"#6B7280",textTransform:"uppercase",
                  fontWeight:600,letterSpacing:".05em",marginBottom:6}}>
                  Bug #{bug.id}
                </div>
                <h1 style={{fontSize:20,fontWeight:600,margin:0,wordBreak:"break-word",lineHeight:1.3}}>
                  {bug.title}
                </h1>
              </div>
              <div className="share-badges">
                <span className="share-pill" style={{background:st.bg,color:st.color}}>
                  {ST_LABEL[bug.status]||bug.status}
                </span>
                <span className="share-pill" style={{background:sev.bg,color:sev.color}}>
                  {SEV_LABEL[bug.severity]||bug.severity}
                </span>
                {bug.priority && (
                  <span className="share-pill" style={{background:"#F3F4F6",color:"#374151"}}>
                    Prioridade: {bug.priority === "low" ? "Baixa" : bug.priority === "medium" ? "Média" : bug.priority === "high" ? "Alta" : "Crítica"}
                  </span>
                )}
                {bug.module_name && (
                  <span className="share-pill" style={{background:"#EFF6FF",color:"#1E40AF"}}>
                    {bug.module_name}
                  </span>
                )}
                {bug.environment && (
                  <span className="share-pill" style={{background:"#F0FDF4",color:"#166534"}}>
                    {bug.environment_name || (bug.environment === "production" ? "Produção" : bug.environment === "homologation" ? "Homologação" : bug.environment === "staging" ? "Staging" : "Desenvolvimento")}
                  </span>
                )}
                {(bug as any).os && (
                  <span className="share-pill" style={{background:"#F8FAFC",color:"#64748B"}}>
                    💻 {(bug as any).os}
                  </span>
                )}
                {(bug as any).browser && (
                  <span className="share-pill" style={{background:"#F8FAFC",color:"#64748B"}}>
                    🌐 {(bug as any).browser}
                  </span>
                )}
              </div>
            </div>
            <div className="share-readonly">
              🔒 <strong>Visualização somente leitura</strong>
              <span>— Este é um link público. Para interagir, faça login no sistema.</span>
            </div>
          </div>

          {/* Layout responsivo */}
          <div className="share-layout">

            {/* Coluna principal */}
            <div>
              {/* Descrição */}
              <div className="share-card">
                <div className="share-card-header">Descrição</div>
                <div className="share-card-body">
                  {bug.description ? (
                    <div className="share-desc" style={{fontSize:13,lineHeight:1.8,
                      whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                      {bug.description.includes("<") && bug.description.includes(">")
                        ? <span dangerouslySetInnerHTML={{__html:bug.description}} />
                        : bug.description}
                    </div>
                  ) : (
                    <p style={{fontSize:13,color:"#9CA3AF",fontStyle:"italic",margin:0}}>Nenhuma descrição.</p>
                  )}
                </div>
              </div>

              {/* Passos */}
              {steps.length > 0 && (
                <div className="share-card">
                  <div className="share-card-header">Passos para reproduzir</div>
                  <div className="share-card-body">
                    {steps.map((step, i) => (
                      <div key={i} className="share-step">
                        <div className="share-step-num">{i+1}</div>
                        <div style={{fontSize:13,lineHeight:1.6,flex:1,padding:"4px 0"}}>{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultado Obtido */}
              {bug.actual_result && (
                <div className="share-card">
                  <div className="share-card-header">Resultado obtido</div>
                  <div className="share-card-body">
                    <p style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",margin:0}}>{bug.actual_result}</p>
                  </div>
                </div>
              )}

              {/* Resultado Esperado */}
              {bug.expected_result && (
                <div className="share-card">
                  <div className="share-card-header">Resultado esperado</div>
                  <div className="share-card-body">
                    <p style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",margin:0}}>{bug.expected_result}</p>
                  </div>
                </div>
              )}

            {(bug as any).impact && (
              <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:"#C2410C",textTransform:"uppercase",
                  letterSpacing:".05em",marginBottom:6}}>⚠ Impacto no negócio</div>
                <p style={{fontSize:13,lineHeight:1.7,margin:0,color:"#7C2D12"}}>{(bug as any).impact}</p>
              </div>
            )}
              {/* Histórico */}
              {bug.activity?.length > 0 && (
                <div className="share-card">
                  <div className="share-card-header">
                    Histórico de atividades
                    <span style={{marginLeft:8,background:"#F3F4F6",color:"#6B7280",
                      borderRadius:10,padding:"1px 7px",fontSize:10}}>
                      {bug.activity.length}
                    </span>
                  </div>
                  <div className="share-card-body">
                    {(() => {
                      const dotColors = {
                        "criou o bug":"#9CA3AF","alterou o status":"#16A34A",
                        "alterou o responsável":"#2563EB","editou o bug":"#D97706",
                        "adicionou comentário":"#7C3AED","adicionou passo":"#0891B2","removeu passo":"#DC2626",
                      };
                      const icons = {
                        "criou o bug":"🐛","alterou o status":"🔄","alterou o responsável":"👤",
                        "editou o bug":"✏️","adicionou comentário":"💬","adicionou passo":"➕","removeu passo":"➖",
                      };
                      const translateDetail = d => d ? d
                        .replace(/open/g,"Aberto").replace(/in_progress/g,"Em andamento")
                        .replace(/fixed/g,"Corrigido").replace(/closed/g,"Fechado")
                        .replace(/active/g,"Ativo").replace(/completed/g,"Concluído")
                        .replace(/archived/g,"Arquivado") : null;
                      return (
                        <div style={{position:"relative",paddingLeft:28}}>
                          <div style={{position:"absolute",left:9,top:6,bottom:6,width:2,
                            background:"#E5E7EB",borderRadius:2}} />
                          {bug.activity.map((a,i) => {
                            const color = dotColors[a.action] || "#9CA3AF";
                            const icon  = icons[a.action] || "📋";
                            return (
                              <div key={a.id||i} style={{position:"relative",marginBottom:i<bug.activity.length-1?16:0}}>
                                <div style={{position:"absolute",left:-28,top:2,width:20,height:20,
                                  borderRadius:"50%",background:color+"20",border:"1.5px solid "+color+"50",
                                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
                                  {icon}
                                </div>
                                <div style={{background:"#F9FAFB",border:"1px solid #E5E7EB",
                                  borderRadius:8,padding:"8px 12px",marginLeft:4}}>
                                  <div style={{fontSize:13,display:"flex",flexWrap:"wrap",alignItems:"center",gap:4}}>
                                    <span style={{fontWeight:600,color:"#111827"}}>{a.user_name||"Sistema"}</span>
                                    <span style={{color:"#6B7280"}}>{a.action}</span>
                                    {translateDetail(a.detail) && (
                                      <span style={{fontSize:11,color:color,background:color+"15",
                                        padding:"2px 8px",borderRadius:10,fontWeight:500}}>
                                        {translateDetail(a.detail)}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>
                                    🕐 {fmtDateTime(a.created_at)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="share-sidebar">
              {/* Detalhes */}
              <div className="share-card">
                <div className="share-card-header">Detalhes</div>
                <div className="share-card-body" style={{padding:"10px 16px"}}>
                  {[
                    {label:"Criado por", value:
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <Avatar name={bug.created_by_name} size={20}/>{bug.created_by_name||"—"}
                      </div>},
                    {label:"Data",        value: fmtDate(bug.created_at)},
                    {label:"Módulo",      value: bug.module_name||"—"},
                    {label:"Versão",      value: (bug as any).version||"—"},
                    {label:"TC",          value: bug.test_case_id ? `TC #${bug.test_case_id}` : "—"},
                    {label:"Responsável", value: bug.assigned_to_name
                      ? <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <Avatar name={bug.assigned_to_name} size={20}/>{bug.assigned_to_name}
                        </div>
                      : "—"},
                    {label:"PR", value: bug.pr_url
                      ? <a href={bug.pr_url.startsWith("http")?bug.pr_url:"#"}
                          style={{color:"#1E40AF",textDecoration:"none",wordBreak:"break-all"}}>
                          {bug.pr_url}
                        </a>
                      : "—"},
                  ].map(({label,value}) => (
                    <div key={label} className="share-detail-row">
                      <span className="share-detail-label">{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tracker */}
              {(bug as any).evidence_url && (
              <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",
                  letterSpacing:".05em",marginBottom:6}}>🎥 Link de Evidência</div>
                <a href={(bug as any).evidence_url} target="_blank" rel="noreferrer"
                  style={{color:"var(--accent)",fontSize:13,wordBreak:"break-all"}}>
                  {(bug as any).evidence_url}
                </a>
              </div>
            )}
            {bug.tracker_url && (
                <div className="share-card">
                  <div className="share-card-header">Tracker</div>
                  <div className="share-card-body">
                    <a href={bug.tracker_url} target="_blank" rel="noreferrer"
                      style={{color:"#1E40AF",fontSize:12,wordBreak:"break-all",textDecoration:"none"}}>
                      🔗 {bug.tracker_url.replace(/^https?:\/\//,"")}
                    </a>
                  </div>
                </div>
              )}

              {/* Anexos */}
              {(bug.evidence_files||[]).length > 0 && (
                <div className="share-card">
                  <div className="share-card-header">Anexos</div>
                  <div className="share-card-body">
                    {bug.evidence_files.map(f => {
                      const apiBase = import.meta.env.VITE_API_URL || "https://qa-manager-api.onrender.com";
                      const url     = f.url || `${apiBase}/uploads/${f.filename}`;
                      const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(f.filename||"");
                      return (
                        <div key={f.id} style={{marginBottom:10}}>
                          {isImage && (
                            <a href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" style={{width:"100%",borderRadius:8,
                                objectFit:"cover",maxHeight:140,marginBottom:6,display:"block"}} />
                            </a>
                          )}
                          <a href={url} target="_blank" rel="noreferrer"
                            style={{fontSize:12,color:"#1E40AF",textDecoration:"none",
                              wordBreak:"break-all"}}>
                            📎 {f.originalname||f.filename}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="share-footer">
            Gerado pelo <strong style={{color:"#1E40AF"}}>QA System</strong> — Link de visualização pública
          </div>
        </div>
      </div>
    </>
  );
}
