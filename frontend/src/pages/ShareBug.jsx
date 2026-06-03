import { useParams } from "react-router-dom";
import { useAsync }  from "../hooks/useAsync.js";

function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}

function Avatar({ name, size=28 }) {
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

const SEV_COLORS = {
  low:      {bg:"#F3F4F6",color:"#6B7280"},
  medium:   {bg:"#FEF9C3",color:"#854D0E"},
  high:     {bg:"#FEE2E2",color:"#991B1B"},
  critical: {bg:"#FEE2E2",color:"#7F1D1D"},
};
const SEV_LABEL   = {low:"Baixa",medium:"Média",high:"Alta",critical:"Crítica"};
const ST_LABEL    = {open:"Aberto",in_progress:"Em andamento",fixed:"Corrigido",closed:"Fechado"};
const ST_COLORS   = {
  open:        {bg:"#FEE2E2",color:"#991B1B"},
  in_progress: {bg:"#DBEAFE",color:"#1E40AF"},
  fixed:       {bg:"#DCFCE7",color:"#166534"},
  closed:      {bg:"#F3F4F6",color:"#6B7280"},
};
const ACT_ICONS = {"criou o bug":"🐛","alterou o status":"🔄","alterou o responsável":"👤","editou o bug":"✏"};

export default function ShareBug() {
  const params = useParams();
  // Fallback: pega o token direto da URL caso useParams não funcione
  const token = params.token || window.location.pathname.split("/share/")[1]?.split("/")[0];

  const { data: bug, loading, error } = useAsync(async () => {
    const res = await fetch(`${getBase()}/share/${token}`);
    if (!res.ok) throw new Error("Link inválido ou expirado");
    const j = await res.json();
    return j.data ?? j;
  }, [token]);

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#F9FAFB",fontSize:14,color:"#6B7280"}}>
      Carregando...
    </div>
  );

  if (error || !bug) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",background:"#F9FAFB",gap:12}}>
      <div style={{fontSize:40}}>🔒</div>
      <div style={{fontSize:18,fontWeight:600,color:"#111"}}>Link inválido ou expirado</div>
      <div style={{fontSize:14,color:"#6B7280"}}>Este link de compartilhamento não existe ou foi removido.</div>
    </div>
  );

  const fmtDate = d => d ? new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}) : "—";
  const fmtDateTime = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };
  const sev = SEV_COLORS[bug.severity] || SEV_COLORS.medium;
  const st  = ST_COLORS[bug.status]   || ST_COLORS.open;
  const steps = bug.steps ? bug.steps.split("\n").filter(Boolean) : [];

  return (
    <div style={{minHeight:"100vh",background:"#F9FAFB",padding:"24px 16px"}}>
      <div style={{maxWidth:800,margin:"0 auto"}}>

        {/* Header */}
        <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
          padding:"20px 24px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:"#6B7280",textTransform:"uppercase",
                fontWeight:600,letterSpacing:".05em",marginBottom:6}}>
                Bug #{bug.id}
              </div>
              <h1 style={{fontSize:20,fontWeight:600,margin:0,wordBreak:"break-word",
                lineHeight:1.3}}>
                {bug.title}
              </h1>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
              <span style={{fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:99,
                background:st.bg,color:st.color}}>
                {ST_LABEL[bug.status]||bug.status}
              </span>
              <span style={{fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:99,
                background:sev.bg,color:sev.color}}>
                {SEV_LABEL[bug.severity]||bug.severity}
              </span>
              {bug.module_name && (
                <span style={{fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:99,
                  background:"#EFF6FF",color:"#1E40AF"}}>
                  {bug.module_name}
                </span>
              )}
            </div>
          </div>

          {/* Aviso de somente leitura */}
          <div style={{marginTop:16,padding:"8px 14px",background:"#FEF9C3",
            border:"1px solid #FDE047",borderRadius:8,fontSize:12,color:"#854D0E",
            display:"flex",alignItems:"center",gap:8}}>
            🔒 <strong>Visualização somente leitura</strong> — Este é um link público compartilhado.
            Para interagir com o bug, faça login no sistema.
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:16,alignItems:"start"}}>

          {/* Coluna esquerda */}
          <div>
            {/* Descrição */}
            <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
              marginBottom:12,overflow:"hidden"}}>
              <div style={{padding:"10px 16px",borderBottom:"1px solid #F3F4F6",
                fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",
                letterSpacing:".05em"}}>DESCRIÇÃO</div>
              <div style={{padding:"14px 16px"}}>
                {bug.description ? (
                  <div style={{fontSize:13,lineHeight:1.7}}
                    dangerouslySetInnerHTML={{__html:bug.description}} />
                ) : (
                  <p style={{fontSize:13,color:"#9CA3AF",fontStyle:"italic"}}>Nenhuma descrição.</p>
                )}
              </div>
            </div>

            {/* Passos */}
            {steps.length > 0 && (
              <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
                marginBottom:12,overflow:"hidden"}}>
                <div style={{padding:"10px 16px",borderBottom:"1px solid #F3F4F6",
                  fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",
                  letterSpacing:".05em"}}>PASSOS PARA REPRODUZIR</div>
                <div style={{padding:"14px 16px"}}>
                  {steps.map((step, i) => (
                    <div key={i} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
                      <div style={{minWidth:26,height:26,borderRadius:"50%",background:"#EFF6FF",
                        color:"#1E40AF",display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,fontWeight:600,flexShrink:0,marginTop:2}}>
                        {i+1}
                      </div>
                      <div style={{fontSize:13,lineHeight:1.6,flex:1,padding:"4px 0"}}>{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Histórico */}
            {bug.activity?.length > 0 && (
              <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
                overflow:"hidden"}}>
                <div style={{padding:"10px 16px",borderBottom:"1px solid #F3F4F6",
                  fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",
                  letterSpacing:".05em"}}>
                  HISTÓRICO DE ATIVIDADES
                  <span style={{marginLeft:8,background:"#F3F4F6",color:"#6B7280",
                    borderRadius:10,padding:"1px 7px",fontSize:10}}>
                    {bug.activity.length}
                  </span>
                </div>
                <div style={{padding:"14px 16px"}}>
                  {bug.activity.map((a,i) => (
                    <div key={a.id||i} style={{display:"flex",gap:10,alignItems:"flex-start",
                      marginBottom:10,paddingBottom:10,
                      borderBottom:i<bug.activity.length-1?"1px solid #F3F4F6":"none"}}>
                      <div style={{fontSize:16,flexShrink:0}}>{ACT_ICONS[a.action]||"📋"}</div>
                      <div>
                        <div style={{fontSize:13}}>
                          <span style={{fontWeight:500}}>{a.user_name||"Sistema"}</span>
                          <span style={{color:"#6B7280",marginLeft:6}}>{a.action}</span>
                          {a.detail && <span style={{fontSize:11,color:"#1E40AF",marginLeft:6,
                            background:"#EFF6FF",padding:"1px 8px",borderRadius:10}}>{a.detail}</span>}
                        </div>
                        <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{fmtDateTime(a.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
              padding:"14px 16px",marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",
                letterSpacing:".05em",marginBottom:12}}>DETALHES</div>
              {[
                {label:"Criado por", value: <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <Avatar name={bug.created_by_name} size={20}/>{bug.created_by_name||"—"}</div>},
                {label:"Data",        value: fmtDate(bug.created_at)},
                {label:"Módulo",      value: bug.module_name||"—"},
                {label:"TC",          value: bug.test_case_id ? `TC #${bug.test_case_id}` : "—"},
                {label:"Responsável", value: bug.assigned_to_name
                  ? <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <Avatar name={bug.assigned_to_name} size={20}/>{bug.assigned_to_name}</div>
                  : "—"},
                {label:"PR", value: bug.pr_url
                  ? <a href={bug.pr_url.startsWith("http")?bug.pr_url:"#"}
                      style={{color:"#1E40AF",textDecoration:"none"}}>{bug.pr_url}</a>
                  : "—"},
              ].map(({label,value}) => (
                <div key={label} style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",padding:"7px 0",borderBottom:"1px solid #F3F4F6",gap:8}}>
                  <span style={{fontSize:11,color:"#6B7280",flexShrink:0}}>{label}</span>
                  <span style={{fontSize:13}}>{value}</span>
                </div>
              ))}
            </div>

            {bug.tracker_url && (
              <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
                padding:"14px 16px",marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",
                  letterSpacing:".05em",marginBottom:8}}>TRACKER</div>
                <a href={bug.tracker_url} target="_blank" rel="noreferrer"
                  style={{color:"#1E40AF",fontSize:12,wordBreak:"break-all",textDecoration:"none"}}>
                  🔗 {bug.tracker_url.replace(/^https?:\/\//,"")}
                </a>
              </div>
            )}

            {(bug.evidence_files||[]).length > 0 && (
              <div style={{background:"white",border:"1px solid #E5E7EB",borderRadius:12,
                padding:"14px 16px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#6B7280",textTransform:"uppercase",
                  letterSpacing:".05em",marginBottom:10}}>ANEXOS</div>
                {bug.evidence_files.map(f => {
                  const apiBase = import.meta.env.VITE_API_URL || "";
                  const url     = f.url || `${apiBase}/uploads/${f.filename}`;
                  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(f.filename||"");
                  return (
                    <div key={f.id} style={{marginBottom:8}}>
                      {isImage && (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="" style={{width:"100%",borderRadius:8,
                            objectFit:"cover",maxHeight:120,marginBottom:4}} />
                        </a>
                      )}
                      <a href={url} target="_blank" rel="noreferrer"
                        style={{fontSize:12,color:"#1E40AF",textDecoration:"none"}}>
                        📎 {f.originalname||f.filename}
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{textAlign:"center",marginTop:24,fontSize:12,color:"#9CA3AF"}}>
          Gerado pelo <strong style={{color:"#1E40AF"}}>QA System</strong> — Link de visualização pública
        </div>
      </div>
    </div>
  );
}
