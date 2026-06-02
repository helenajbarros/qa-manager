import { useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAsync }   from "../hooks/useAsync.js";
import { bugsApi, modulesApi, testCasesApi, usersApi } from "../services/resources.js";
import { useAuth }    from "../context/AuthContext.jsx";
import { useProject } from "../context/ProjectContext.jsx";
import { Loading, ErrorMsg, ConfirmModal, Field, Select, Severity, BugStatus } from "../components/UI.jsx";

const SEV_OPTS    = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const STATUS_OPTS = [{value:"open",label:"Aberto"},{value:"in_progress",label:"Em andamento"},{value:"fixed",label:"Corrigido"},{value:"closed",label:"Fechado"}];
const ACT_ICONS   = {"criou o bug":"🐛","alterou o status":"🔄","alterou o responsável":"👤","editou o bug":"✏","adicionou passo":"➕","removeu passo":"➖"};

function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}
function getToken() { return localStorage.getItem("qa_token"); }

function Avatar({ name, size=30 }) {
  const initials = (name||"?").split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
  const colors = ["#2563EB","#7C3AED","#059669","#DC2626","#D97706","#0891B2"];
  const color  = colors[(name||"").charCodeAt(0) % colors.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:color+"22",
      color,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.33,fontWeight:500,flexShrink:0}}>
      {initials}
    </div>
  );
}

// Passos editáveis inline com autosave
function StepsSection({ bugId, initialSteps, isViewer, onSaved }) {
  const parseSteps = s => s ? s.split("\n").filter(Boolean) : [];
  const [steps,    setSteps]   = useState(parseSteps(initialSteps));
  const [saving,   setSaving]  = useState(false);
  const [saved,    setSaved]   = useState(false);
  const saveTimer = useRef(null);

  const autoSave = useCallback(async (newSteps) => {
    setSaving(true); setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await bugsApi.update(bugId, { steps: newSteps.join("\n") });
        setSaving(false); setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (onSaved) onSaved();
      } catch(e) { setSaving(false); }
    }, 600);
  }, [bugId]);

  function updateStep(i, val) {
    const next = [...steps];
    next[i] = val;
    setSteps(next);
    autoSave(next);
  }

  function addStep() {
    const next = [...steps, ""];
    setSteps(next);
    autoSave(next);
    setTimeout(() => {
      const inputs = document.querySelectorAll(".step-input");
      if (inputs[inputs.length-1]) inputs[inputs.length-1].focus();
    }, 50);
  }

  function removeStep(i) {
    const next = steps.filter((_, idx) => idx !== i);
    setSteps(next);
    autoSave(next);
  }

  return (
    <div>
      {/* Indicador de autosave */}
      <div style={{height:18,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
        {saving && <span style={{fontSize:11,color:"var(--text-muted)"}}>⏳ Salvando...</span>}
        {saved  && <span style={{fontSize:11,color:"var(--success)"}}>✓ Salvo</span>}
      </div>

      {steps.length === 0 && (
        <p style={{fontSize:13,color:"var(--text-muted)",fontStyle:"italic",marginBottom:12}}>
          Nenhum passo adicionado.
        </p>
      )}

      {steps.map((step, i) => (
        <div key={i} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
          {/* Número */}
          <div style={{minWidth:26,height:26,borderRadius:"50%",background:"var(--accent-bg)",
            color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:500,flexShrink:0,marginTop:4}}>
            {i+1}
          </div>

          {/* Input inline */}
          {isViewer ? (
            <div style={{flex:1,fontSize:13,lineHeight:1.6,padding:"6px 12px",
              background:"var(--bg)",borderRadius:8}}>{step}</div>
          ) : (
            <input
              className="step-input"
              value={step}
              onChange={e => updateStep(i, e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); addStep(); }
                if (e.key === "Backspace" && step === "") { e.preventDefault(); removeStep(i); }
              }}
              placeholder={`Passo ${i+1}...`}
              style={{flex:1,padding:"6px 12px",borderRadius:8,
                border:"0.5px solid var(--border)",fontSize:13,
                background:"var(--bg)",color:"var(--text)",
                outline:"none",transition:"border-color .12s"}}
              onFocus={e => e.target.style.borderColor="var(--accent)"}
              onBlur={e => e.target.style.borderColor="var(--border)"}
            />
          )}

          {/* Deletar */}
          {!isViewer && (
            <button onClick={() => removeStep(i)}
              style={{background:"none",border:"none",cursor:"pointer",
                color:"var(--text-muted)",padding:"6px",borderRadius:6,
                fontSize:13,flexShrink:0,marginTop:2,transition:"background .12s"}}
              onMouseEnter={e=>e.target.style.background="#FCEBEB"}
              onMouseLeave={e=>e.target.style.background="none"}>
              ✕
            </button>
          )}
        </div>
      ))}

      {/* Adicionar passo */}
      {!isViewer && (
        <button onClick={addStep}
          style={{width:"100%",padding:"8px",marginTop:4,
            border:"0.5px dashed var(--border)",borderRadius:8,
            background:"transparent",cursor:"pointer",fontSize:12,
            color:"var(--text-muted)",fontFamily:"inherit",transition:"background .12s"}}
          onMouseEnter={e=>e.target.style.background="var(--bg)"}
          onMouseLeave={e=>e.target.style.background="transparent"}>
          + Adicionar passo
        </button>
      )}

      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8}}>
        💡 Clique num passo para editar. Enter adiciona novo passo. Backspace no passo vazio remove.
      </div>
    </div>
  );
}

function CommentsSection({ bugId, currentUser }) {
  const { data: comments, refetch } = useAsync(async () => {
    const res = await fetch(`${getBase()}/bugs/${bugId}/comments`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const j = await res.json();
    return j.data ?? j ?? [];
  }, [bugId]);

  const [text,       setText]       = useState("");
  const [editId,     setEditId]     = useState(null);
  const [editText,   setEditText]   = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving,     setSaving]     = useState(false);

  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await fetch(`${getBase()}/bugs/${bugId}/comments`, {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},
        body: JSON.stringify({ text }),
      });
      setText(""); refetch();
    } finally { setSaving(false); }
  }

  async function handleEdit(id) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await fetch(`${getBase()}/bugs/${bugId}/comments/${id}`, {
        method:"PUT",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},
        body: JSON.stringify({ text: editText }),
      });
      setEditId(null); refetch();
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    await fetch(`${getBase()}/bugs/${bugId}/comments/${id}`,{
      method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}
    });
    setConfirmDel(null); refetch();
  }

  const isAdmin = currentUser?.role === "admin";

  return (
    <div>
      <div style={{fontSize:13,fontWeight:500,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        💬 Comentários
        <span style={{fontSize:11,color:"var(--text-muted)",fontWeight:400}}>({comments?.length||0})</span>
      </div>

      {(comments||[]).length === 0 && (
        <div style={{color:"var(--text-muted)",fontSize:13,marginBottom:16,fontStyle:"italic"}}>
          Nenhum comentário ainda.
        </div>
      )}

      {(comments||[]).map(c => {
        const isOwn = String(c.user_id) === String(currentUser?.id);
        return (
          <div key={c.id} style={{display:"flex",gap:10,marginBottom:18}}>
            <Avatar name={c.user_name} size={32} />
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div>
                  <span style={{fontWeight:500,fontSize:13}}>{c.user_name}</span>
                  {isOwn && <span style={{fontSize:10,marginLeft:6,color:"var(--accent)",
                    background:"var(--accent-bg)",padding:"1px 6px",borderRadius:10}}>(você)</span>}
                  <span style={{fontSize:11,color:"var(--text-muted)",marginLeft:8}}>{fmtDate(c.created_at)}</span>
                  {c.updated_at !== c.created_at && (
                    <span style={{fontSize:10,color:"var(--text-muted)",marginLeft:6,fontStyle:"italic"}}>(editado)</span>
                  )}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {isOwn && editId!==c.id && (
                    <button onClick={()=>{setEditId(c.id);setEditText(c.text);}}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--text-muted)"}}>✏</button>
                  )}
                  {(isOwn||isAdmin) && (
                    <button onClick={()=>setConfirmDel(c)}
                      style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--danger)"}}>🗑</button>
                  )}
                </div>
              </div>
              {editId===c.id ? (
                <div>
                  <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3}
                    style={{width:"100%",padding:"8px",borderRadius:6,
                      border:"1px solid var(--accent)",fontSize:13,resize:"vertical",
                      background:"var(--surface)"}} />
                  <div style={{display:"flex",gap:8,marginTop:6}}>
                    <button className="btn btn-primary btn-sm" onClick={()=>handleEdit(c.id)} disabled={saving}>
                      {saving?"Salvando…":"Salvar"}
                    </button>
                    <button className="btn btn-sm" onClick={()=>setEditId(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{fontSize:13,whiteSpace:"pre-line",lineHeight:1.6,
                  background:"var(--bg)",padding:"10px 14px",borderRadius:8}}>{c.text}</div>
              )}
            </div>
          </div>
        );
      })}

      {/* Novo comentário */}
      <div style={{display:"flex",gap:10,alignItems:"flex-start",
        borderTop:"1px solid var(--border)",paddingTop:16,marginTop:8}}>
        <Avatar name={currentUser?.name} size={32} />
        <div style={{flex:1}}>
          <textarea value={text} onChange={e=>setText(e.target.value)}
            placeholder="Adicionar comentário..."
            rows={3} style={{width:"100%",padding:"10px 14px",borderRadius:8,
              border:"1px solid var(--border)",fontSize:13,resize:"vertical",
              background:"var(--surface)"}} />
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}>
            <button className="btn btn-primary" onClick={handleAdd}
              disabled={saving||!text.trim()} style={{fontSize:12}}>
              {saving?"Enviando…":"💬 Comentar"}
            </button>
          </div>
        </div>
      </div>

      {confirmDel && (
        <ConfirmModal message="Excluir este comentário?"
          onConfirm={()=>handleDelete(confirmDel.id)} onCancel={()=>setConfirmDel(null)} />
      )}
    </div>
  );
}

function ActivitySection({ activity }) {
  if (!activity?.length) return null;
  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };
  return (
    <div>
      <div style={{fontSize:13,fontWeight:500,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
        📋 Histórico
        <span style={{fontSize:11,color:"var(--text-muted)",fontWeight:400}}>({activity.length})</span>
      </div>
      {activity.map(a => (
        <div key={a.id} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
          <div style={{fontSize:16,flexShrink:0}}>{ACT_ICONS[a.action]||"📋"}</div>
          <div style={{flex:1}}>
            <span style={{fontWeight:500,fontSize:13}}>{a.user_name||"Sistema"}</span>
            <span style={{fontSize:13,color:"var(--text-muted)",marginLeft:6}}>{a.action}</span>
            {a.detail && <span style={{fontSize:11,color:"var(--accent)",marginLeft:6,
              background:"var(--accent-bg)",padding:"1px 8px",borderRadius:10}}>{a.detail}</span>}
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{fmtDate(a.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelatedBugsSection({ bugId, relatedBugs, allBugs, onAdd, onRemove, isViewer }) {
  const [adding, setAdding] = useState(false);
  const [selId,  setSelId]  = useState("");
  const relatedIds = (relatedBugs||[]).map(b => String(b.related_bug_id));
  const available  = (allBugs||[]).filter(b => String(b.id) !== String(bugId) && !relatedIds.includes(String(b.id)));

  return (
    <div>
      <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
        textTransform:"uppercase",letterSpacing:".05em",marginBottom:10,
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        Bugs relacionados
        <span style={{background:"var(--border)",color:"var(--text-muted)",borderRadius:12,
          padding:"1px 8px",fontSize:10}}>{relatedBugs?.length||0}</span>
      </div>

      {(relatedBugs||[]).length === 0 && (
        <p style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic",marginBottom:8}}>Nenhum bug relacionado.</p>
      )}

      {(relatedBugs||[]).map(b => (
        <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"8px 0",borderBottom:"0.5px solid var(--border)"}}>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:"var(--accent)"}}>#{b.related_bug_id} · {b.title}</div>
            <div style={{fontSize:11,color:"var(--text-muted)"}}>{b.module_name}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <BugStatus v={b.status} />
            {!isViewer && (
              <button onClick={()=>onRemove(b.related_bug_id)}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",fontSize:12}}>✕</button>
            )}
          </div>
        </div>
      ))}

      {!isViewer && !adding && (
        <button className="btn btn-sm" style={{marginTop:8,width:"100%"}} onClick={()=>setAdding(true)}>+ Vincular bug</button>
      )}

      {adding && (
        <div style={{marginTop:8,display:"flex",gap:8}}>
          <select value={selId} onChange={e=>setSelId(e.target.value)}
            style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}}>
            <option value="">Selecione...</option>
            {available.map(b=><option key={b.id} value={b.id}>#{b.id} {b.title}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!selId}
            onClick={()=>{onAdd(selId);setAdding(false);setSelId("");}}>Vincular</button>
          <button className="btn btn-sm" onClick={()=>setAdding(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

export default function BugDetail() {
  const { id }             = useParams();
  const navigate           = useNavigate();
  const { user }           = useAuth();
  const { currentProject } = useProject();
  const pid      = currentProject?.id;
  const isViewer = user?.role === "viewer";

  const { data: bug,        loading: l1, error: e1, refetch } = useAsync(() => bugsApi.get(id), [id]);
  const { data: modules }   = useAsync(() => modulesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: testCases } = useAsync(() => testCasesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: users }     = useAsync(() => usersApi.list(), []);
  const { data: allBugs }   = useAsync(() => bugsApi.list(pid?{project_id:pid}:{}), [pid]);

  const [form,    setForm]    = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  if (l1) return <Loading />;
  if (e1 || !bug) return <ErrorMsg msg={e1||"Bug não encontrado"} />;

  const fmtDate = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const isEditing = !!form;

  function startEdit() {
    setForm({
      title:          bug.title          || "",
      description:    bug.description    || "",
      comment:        bug.comment        || "",
      tracker_url:    bug.tracker_url    || "",
      pr_url:         bug.pr_url         || "",
      severity:       bug.severity       || "medium",
      status:         bug.status         || "open",
      module_id:      bug.module_id      || "",
      test_case_id:   bug.test_case_id   || "",
      assigned_to_id: bug.assigned_to_id || "",
      steps:          bug.steps          || "",
    });
  }

  async function handleSave() {
    setSaving(true); setErr(null);
    try {
      await bugsApi.update(bug.id, form);
      setForm(null);
      refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(file) {
    const fd = new FormData(); fd.append("file", file);
    await fetch(`${getBase()}/bugs/${bug.id}/files`,{
      method:"POST",body:fd,headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  async function handleFileDelete(fileId) {
    await fetch(`${getBase()}/bugs/${bug.id}/files/${fileId}`,{
      method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  async function handleAddRelation(relatedId) {
    await fetch(`${getBase()}/bugs/${bug.id}/relations`,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},
      body:JSON.stringify({related_bug_id:relatedId})
    });
    refetch();
  }

  async function handleRemoveRelation(relatedId) {
    await fetch(`${getBase()}/bugs/${bug.id}/relations/${relatedId}`,{
      method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  async function handleDelete() {
    try { await bugsApi.delete(bug.id); navigate("/bugs"); }
    catch(e) { setErr(e.message); }
  }

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="btn" onClick={()=>navigate("/bugs")}>← Voltar</button>
          <div>
            <div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",fontWeight:600,marginBottom:2}}>
              Bug #{bug.id}
            </div>
            {isEditing
              ? <input value={form.title} onChange={set("title")} autoFocus
                  style={{fontSize:18,fontWeight:500,border:"none",
                    borderBottom:"2px solid var(--accent)",background:"transparent",
                    width:"100%",minWidth:300,outline:"none"}} />
              : <h1 style={{fontSize:18,margin:0,fontWeight:500}}>{bug.title}</h1>
            }
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {!isViewer && !isEditing && (
            <>
              <button className="btn" onClick={startEdit}>✏ Editar</button>
              <button className="btn btn-danger" onClick={()=>setConfirm(true)}>🗑 Excluir</button>
            </>
          )}
          {isEditing && (
            <>
              <button className="btn" onClick={()=>setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving?"Salvando…":"💾 Salvar"}
              </button>
            </>
          )}
        </div>
      </div>

      {err && <ErrorMsg msg={err} />}

      {/* Badges */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        {isEditing ? (
          <>
            <Select value={form.status}   onChange={v=>setForm(f=>({...f,status:v}))}   options={STATUS_OPTS} />
            <Select value={form.severity} onChange={v=>setForm(f=>({...f,severity:v}))} options={SEV_OPTS} />
          </>
        ) : (
          <>
            <BugStatus v={bug.status} />
            <Severity  v={bug.severity} />
            {bug.module_name && <span className="badge badge-active">{bug.module_name}</span>}
            {bug.test_case_id && (
              <span style={{fontSize:12,color:"var(--accent)",fontWeight:500,
                background:"var(--accent-bg)",padding:"2px 10px",borderRadius:10}}>
                TC #{bug.test_case_id}
              </span>
            )}
          </>
        )}
      </div>

      {/* Layout dois painéis */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:20,alignItems:"start"}}>

        {/* Coluna esquerda */}
        <div>

          {/* Descrição */}
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
              textTransform:"uppercase",letterSpacing:".05em",padding:"12px 16px",
              borderBottom:"0.5px solid var(--border)"}}>Descrição</div>
            <div style={{padding:"12px 16px"}}>
              {isEditing ? (
                <textarea value={form.description} onChange={set("description")} rows={4}
                  placeholder="Descreva o bug..."
                  style={{width:"100%",padding:10,borderRadius:8,border:"1px solid var(--border)",
                    fontSize:13,resize:"vertical",background:"var(--bg)"}} />
              ) : bug.description ? (
                <div style={{fontSize:13,whiteSpace:"pre-line",lineHeight:1.7}}>{bug.description}</div>
              ) : (
                <p style={{color:"var(--text-muted)",fontStyle:"italic",fontSize:13}}>Nenhuma descrição adicionada.</p>
              )}
            </div>
          </div>

          {/* Passos para reproduzir */}
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
              textTransform:"uppercase",letterSpacing:".05em",padding:"12px 16px",
              borderBottom:"0.5px solid var(--border)"}}>Passos para reproduzir</div>
            <div style={{padding:"12px 16px"}}>
              <StepsSection
                bugId={bug.id}
                initialSteps={bug.steps}
                isViewer={isViewer}
                onSaved={refetch}
              />
            </div>
          </div>

          {/* Comentário geral */}
          {(isEditing || bug.comment) && (
            <div className="card" style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
                textTransform:"uppercase",letterSpacing:".05em",padding:"12px 16px",
                borderBottom:"0.5px solid var(--border)"}}>Comentário geral</div>
              <div style={{padding:"12px 16px"}}>
                {isEditing ? (
                  <textarea value={form.comment} onChange={set("comment")} rows={3}
                    style={{width:"100%",padding:10,borderRadius:8,border:"1px solid var(--border)",
                      fontSize:13,resize:"vertical",background:"var(--bg)"}} />
                ) : (
                  <div style={{fontSize:13,whiteSpace:"pre-line",lineHeight:1.7}}>{bug.comment}</div>
                )}
              </div>
            </div>
          )}

          {/* Comentários */}
          <div className="card" style={{marginBottom:16}}>
            <div style={{padding:"12px 16px"}}>
              <CommentsSection bugId={bug.id} currentUser={user} />
            </div>
          </div>

          {/* Histórico */}
          {bug.activity?.length > 0 && (
            <div className="card">
              <div style={{padding:"12px 16px"}}>
                <ActivitySection activity={bug.activity} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Detalhes */}
          <div className="card" style={{padding:"12px 16px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
              textTransform:"uppercase",letterSpacing:".05em",marginBottom:12}}>Detalhes</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {label:"Criado por",value:<div style={{display:"flex",alignItems:"center",gap:6}}><Avatar name={bug.created_by_name} size={20}/>{bug.created_by_name||"—"}</div>},
                {label:"Data",      value:<span style={{fontSize:13}}>{fmtDate(bug.created_at)}</span>},
                {label:"Módulo",    value: isEditing
                  ? <Select value={form.module_id} onChange={v=>setForm(f=>({...f,module_id:v}))} options={(modules||[]).map(m=>({value:m.id,label:m.name}))} placeholder="—" />
                  : <span style={{fontSize:13}}>{bug.module_name||"—"}</span>},
                {label:"TC",        value: isEditing
                  ? <Select value={form.test_case_id} onChange={v=>setForm(f=>({...f,test_case_id:v}))} options={(testCases||[]).map(t=>({value:t.id,label:`#${t.id} ${t.title}`}))} placeholder="—" />
                  : bug.test_case_id ? <span style={{fontSize:12,color:"var(--accent)",fontWeight:500}}>TC #{bug.test_case_id}</span> : <span style={{fontSize:13}}>—</span>},
                {label:"Responsável",value: isEditing
                  ? <Select value={form.assigned_to_id} onChange={v=>setForm(f=>({...f,assigned_to_id:v}))} options={(users||[]).map(u=>({value:u.id,label:u.name}))} placeholder="—" />
                  : bug.assigned_to_name ? <div style={{display:"flex",alignItems:"center",gap:6}}><Avatar name={bug.assigned_to_name} size={20}/>{bug.assigned_to_name}</div> : <span style={{fontSize:13,color:"var(--text-muted)"}}>—</span>},
                {label:"PR",        value: isEditing
                  ? <input value={form.pr_url} onChange={set("pr_url")} placeholder="#241 ou URL" style={{width:120,padding:"3px 8px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}} />
                  : bug.pr_url ? <a href={bug.pr_url.startsWith("http")?bug.pr_url:"#"} style={{fontSize:13,color:"var(--accent)",fontWeight:500,textDecoration:"none"}}>{bug.pr_url}</a> : (!isViewer ? <button className="btn btn-sm" style={{fontSize:10}} onClick={startEdit}>+ Adicionar</button> : <span style={{fontSize:13,color:"var(--text-muted)"}}>—</span>)},
              ].map(({label,value}) => (
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  borderBottom:"0.5px solid var(--border)",paddingBottom:8,gap:8}}>
                  <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>{label}</span>
                  <div style={{fontSize:13}}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tracker */}
          <div className="card" style={{padding:"12px 16px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
              textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Tracker</div>
            {isEditing ? (
              <input value={form.tracker_url} onChange={set("tracker_url")} placeholder="https://..."
                style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}} />
            ) : bug.tracker_url ? (
              <a href={bug.tracker_url} target="_blank" rel="noreferrer"
                style={{color:"var(--accent)",fontSize:12,wordBreak:"break-all",textDecoration:"none"}}>
                🔗 {bug.tracker_url.replace(/^https?:\/\//,"")}
              </a>
            ) : (
              <p style={{color:"var(--text-muted)",fontSize:12,fontStyle:"italic"}}>Nenhum tracker vinculado.</p>
            )}
          </div>

          {/* Anexos */}
          <div className="card" style={{padding:"12px 16px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
              textTransform:"uppercase",letterSpacing:".05em",marginBottom:10}}>Anexos</div>
            {(bug.evidence_files||[]).length === 0 && (
              <p style={{color:"var(--text-muted)",fontSize:12,fontStyle:"italic",marginBottom:10}}>Nenhum anexo.</p>
            )}
            {(bug.evidence_files||[]).map(f => {
              const url     = f.url || `/uploads/${f.filename}`;
              const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(f.filename||"");
              const isVideo = /\.(mp4|webm|mov)$/i.test(f.filename||"");
              return (
                <div key={f.id} style={{marginBottom:8}}>
                  {isImage && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{width:"100%",borderRadius:8,objectFit:"cover",maxHeight:120,marginBottom:4}}/></a>}
                  {isVideo && <video controls style={{width:"100%",borderRadius:8,marginBottom:4}}><source src={url}/></video>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <a href={url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--accent)"}}>📎 {f.originalname||f.filename}</a>
                    {!isViewer && <button onClick={()=>handleFileDelete(f.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",fontSize:11}}>✕</button>}
                  </div>
                </div>
              );
            })}
            {!isViewer && (
              <label style={{display:"block",marginTop:8,cursor:"pointer"}}>
                <div className="btn btn-sm" style={{width:"100%",textAlign:"center",display:"block"}}>+ Adicionar arquivo</div>
                <input type="file" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFileUpload(e.target.files[0])} />
              </label>
            )}
          </div>

          {/* Bugs relacionados */}
          <div className="card" style={{padding:"12px 16px"}}>
            <RelatedBugsSection
              bugId={bug.id}
              relatedBugs={bug.related_bugs}
              allBugs={allBugs}
              onAdd={handleAddRelation}
              onRemove={handleRemoveRelation}
              isViewer={isViewer}
            />
          </div>

        </div>
      </div>

      {confirm && (
        <ConfirmModal message={`Excluir o bug "${bug.title}"?`}
          onConfirm={handleDelete} onCancel={()=>setConfirm(false)} />
      )}
    </div>
  );
}
