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


// ── Acordeão ──────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen=true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{marginBottom:16,overflow:"visible"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"12px 16px",cursor:"pointer",userSelect:"none",
          borderBottom: open ? "1px solid var(--border)" : "none",
          transition:"border-color .2s"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
            textTransform:"uppercase",letterSpacing:".05em"}}>{title}</span>
          {badge !== undefined && (
            <span style={{background:"var(--accent)",color:"white",borderRadius:12,
              padding:"1px 8px",fontSize:10,fontWeight:500}}>{badge}</span>
          )}
        </div>
        <span style={{color:"var(--text-muted)",fontSize:14,transition:"transform .22s ease",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",display:"inline-block"}}>
          ▾
        </span>
      </div>
      <div style={{display: open ? "block" : "none"}}>
        {children}
      </div>
    </div>
  );
}

function SidebarAccordion({ title, children, defaultOpen=true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"10px 16px",cursor:"pointer",userSelect:"none",
          borderBottom: open ? "1px solid var(--border)" : "none"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",
            textTransform:"uppercase",letterSpacing:".05em"}}>{title}</span>
          {badge !== undefined && (
            <span style={{background:"var(--border)",color:"var(--text-muted)",borderRadius:12,
              padding:"1px 7px",fontSize:10}}>{badge}</span>
          )}
        </div>
        <span style={{color:"var(--text-muted)",fontSize:14,transition:"transform .22s ease",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",display:"inline-block"}}>
          ▾
        </span>
      </div>
      <div style={{display: open ? "block" : "none", padding:"12px 16px"}}>
        {children}
      </div>
    </div>
  );
}

// ── Toolbar de formatação ─────────────────────────────────────
function FormatToolbar({ editorRef, onMention }) {
  function exec(cmd, val) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val||null);
  }
  function insertCode() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const code  = document.createElement("code");
    code.style.cssText = "background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:12px;color:#B5451B";
    const txt = range.toString();
    if (txt) { range.deleteContents(); code.textContent = txt; range.insertNode(code); }
    else { code.textContent = "código"; range.insertNode(code); }
  }
  function insertLink() {
    const url = prompt("URL do link:");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
  }
  const btnStyle = {
    background:"none",border:"1px solid var(--border)",borderRadius:6,
    cursor:"pointer",padding:"4px 8px",fontSize:12,color:"var(--text-muted)",
    fontFamily:"inherit",transition:"background .12s"
  };
  return (
    <div style={{display:"flex",gap:4,padding:"6px 0",flexWrap:"wrap"}}>
      <button style={{...btnStyle,fontWeight:700}} onClick={()=>exec("bold")} title="Negrito">B</button>
      <button style={{...btnStyle,fontStyle:"italic"}} onClick={()=>exec("italic")} title="Itálico">I</button>
      <button style={{...btnStyle,textDecoration:"underline"}} onClick={()=>exec("underline")} title="Sublinhado">U</button>
      <button style={btnStyle} onClick={insertCode} title="Código">&lt;/&gt;</button>
      <button style={btnStyle} onClick={insertLink} title="Link">🔗</button>
      <button style={btnStyle} onClick={()=>exec("insertUnorderedList")} title="Lista">• Lista</button>
      {onMention && (
        <button style={btnStyle} onClick={onMention} title="Mencionar">@ Mencionar</button>
      )}
    </div>
  );
}

// ── Passos editáveis com autosave ─────────────────────────────
function StepsSection({ bugId, initialSteps, isViewer, onSaved }) {
  const parseSteps = s => s ? s.split("\n").filter(Boolean) : [];
  const [steps,   setSteps]  = useState(parseSteps(initialSteps));
  const [saving,  setSaving] = useState(false);
  const [saved,   setSaved]  = useState(false);
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
      } catch { setSaving(false); }
    }, 600);
  }, [bugId]);

  function updateStep(i, val) {
    const next = [...steps]; next[i] = val; setSteps(next); autoSave(next);
  }
  function addStep() {
    const next = [...steps, ""]; setSteps(next); autoSave(next);
    setTimeout(() => {
      const inputs = document.querySelectorAll(".step-input");
      if (inputs[inputs.length-1]) inputs[inputs.length-1].focus();
    }, 50);
  }
  function removeStep(i) {
    const next = steps.filter((_, idx) => idx !== i); setSteps(next); autoSave(next);
  }

  return (
    <div>
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
          <div style={{minWidth:26,height:26,borderRadius:"50%",background:"var(--accent-bg)",
            color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:500,flexShrink:0,marginTop:4}}>
            {i+1}
          </div>
          {isViewer ? (
            <div style={{flex:1,fontSize:13,lineHeight:1.6,padding:"6px 12px",
              background:"var(--bg)",borderRadius:8}}>{step}</div>
          ) : (
            <input className="step-input" value={step}
              onChange={e => updateStep(i, e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter")     { e.preventDefault(); addStep(); }
                if (e.key === "Backspace" && step === "") { e.preventDefault(); removeStep(i); }
              }}
              placeholder={`Passo ${i+1}...`}
              style={{flex:1,padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",
                fontSize:13,background:"var(--bg)",color:"var(--text)",outline:"none",
                transition:"border-color .12s"}}
              onFocus={e => e.target.style.borderColor="var(--accent)"}
              onBlur={e  => e.target.style.borderColor="var(--border)"}
            />
          )}
          {!isViewer && (
            <button onClick={() => removeStep(i)}
              style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",
                padding:"6px",borderRadius:6,fontSize:13,flexShrink:0,marginTop:2}}>✕</button>
          )}
        </div>
      ))}
      {!isViewer && (
        <button onClick={addStep}
          style={{width:"100%",padding:"8px",marginTop:4,border:"1px dashed var(--border)",
            borderRadius:8,background:"transparent",cursor:"pointer",fontSize:12,
            color:"var(--text-muted)",fontFamily:"inherit"}}>
          + Adicionar passo
        </button>
      )}
      <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8}}>
        💡 Clique num passo para editar. Enter adiciona novo. Backspace no passo vazio remove.
      </div>
    </div>
  );
}

// ── Comentários ───────────────────────────────────────────────
function CommentsSection({ bugId, currentUser, allUsers }) {
  const { data: comments, refetch } = useAsync(async () => {
    const res = await fetch(`${getBase()}/bugs/${bugId}/comments`,{
      headers:{Authorization:`Bearer ${getToken()}`}
    });
    const j = await res.json();
    return j.data ?? j ?? [];
  }, [bugId]);

  const editorRef   = useRef(null);
  const [saving,    setSaving]    = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [editText,  setEditText]  = useState("");
  const [confirmDel,setConfirmDel]= useState(null);
  const [showMention,setShowMention]=useState(false);
  const [mentionQ,  setMentionQ]  = useState("");

  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };

  function handleInput(e) {
    const txt = editorRef.current?.innerText || "";
    const at  = txt.lastIndexOf("@");
    if (at >= 0) {
      const q = txt.slice(at+1);
      if (!q.includes(" ") || q === "") { setMentionQ(q); setShowMention(true); return; }
    }
    setShowMention(false);
  }

  function insertMention(name) {
    const el = editorRef.current;
    if (!el) return;
    const txt  = el.innerText;
    const at   = txt.lastIndexOf("@");
    const before = txt.slice(0, at);
    const chip = document.createElement("span");
    chip.style.cssText = "background:var(--accent-bg);color:var(--accent);border-radius:4px;padding:1px 6px;font-weight:500";
    chip.textContent   = `@${name}`;
    chip.contentEditable = "false";
    el.innerHTML = "";
    el.appendChild(document.createTextNode(before));
    el.appendChild(chip);
    el.appendChild(document.createTextNode(" "));
    setShowMention(false);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }

  const filteredUsers = (allUsers||[]).filter(u =>
    u.name.toLowerCase().includes(mentionQ.toLowerCase())
  );

  async function handleAdd() {
    const html = editorRef.current?.innerHTML?.trim();
    const text = editorRef.current?.innerText?.trim();
    if (!text) return;
    setSaving(true);
    try {
      await fetch(`${getBase()}/bugs/${bugId}/comments`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},
        body: JSON.stringify({ text }),
      });
      if (editorRef.current) editorRef.current.innerHTML = "";
      refetch();
    } finally { setSaving(false); }
  }

  async function handleEdit(id) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await fetch(`${getBase()}/bugs/${bugId}/comments/${id}`,{
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
      <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",
        letterSpacing:".05em",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        COMENTÁRIOS
        <span style={{background:"var(--accent)",color:"white",borderRadius:12,
          padding:"1px 8px",fontSize:10}}>{comments?.length||0}</span>
      </div>

      {(comments||[]).length === 0 && (
        <p style={{fontSize:13,color:"var(--text-muted)",fontStyle:"italic",marginBottom:16}}>
          Nenhum comentário ainda.
        </p>
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
                    style={{width:"100%",padding:"8px",borderRadius:6,border:"1px solid var(--accent)",
                      fontSize:13,resize:"vertical",background:"var(--surface)"}} />
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
        <div style={{flex:1,position:"relative"}}>
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            data-placeholder="Adicione um comentário... Use @ para mencionar alguém"
            style={{minHeight:60,padding:"10px 14px",borderRadius:8,border:"1px solid var(--border)",
              fontSize:13,lineHeight:1.6,outline:"none",background:"var(--surface)",
              cursor:"text"}}
            suppressContentEditableWarning
          />
          <style>{`[data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--text-muted);font-style:italic;pointer-events:none}`}</style>

          {/* Dropdown de menções */}
          {showMention && filteredUsers.length > 0 && (
            <div style={{position:"absolute",top:"100%",left:0,background:"var(--surface)",
              border:"1px solid var(--border)",borderRadius:8,zIndex:200,
              minWidth:180,maxHeight:160,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}>
              {filteredUsers.map(u => (
                <div key={u.id} onClick={()=>insertMention(u.name)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                    cursor:"pointer",fontSize:13}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--bg)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <Avatar name={u.name} size={22} />
                  {u.name}
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <FormatToolbar editorRef={editorRef} onMention={()=>{
            const el = editorRef.current;
            if (el) {
              el.focus();
              document.execCommand("insertText", false, "@");
              setShowMention(true); setMentionQ("");
            }
          }} />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
            <span style={{fontSize:11,color:"var(--text-muted)"}}>@ Digite @ para mencionar um membro</span>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving} style={{fontSize:12}}>
              {saving?"Enviando…":"✈ Comentar"}
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

// ── Histórico ─────────────────────────────────────────────────
function ActivitySection({ activity }) {
  if (!activity?.length) return null;
  const fmtDate = d => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };
  const dotColors = {
    "criou o bug":"var(--text-muted)","alterou o status":"var(--success)",
    "alterou o responsável":"var(--accent)","editou o bug":"var(--warning)",
  };
  return (
    <div>
      <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",
        letterSpacing:".05em",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        HISTÓRICO DE ATIVIDADES
        <span style={{background:"var(--border)",color:"var(--text-muted)",borderRadius:12,
          padding:"1px 8px",fontSize:10}}>{activity.length}</span>
      </div>
      {activity.map((a,i) => (
        <div key={a.id||i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12,
          paddingBottom:12,borderBottom:i<activity.length-1?"1px solid var(--border)":"none"}}>
          <div style={{width:10,height:10,borderRadius:"50%",flexShrink:0,marginTop:4,
            background:dotColors[a.action]||"var(--text-muted)"}} />
          <div style={{flex:1}}>
            <div style={{fontSize:13,lineHeight:1.5}}>
              <span style={{fontWeight:500}}>{a.user_name||"Sistema"}</span>
              <span style={{color:"var(--text-muted)",marginLeft:6}}>{a.action}</span>
              {a.detail && (
                <span style={{fontSize:11,color:"var(--accent)",marginLeft:6,
                  background:"var(--accent-bg)",padding:"1px 8px",borderRadius:10}}>
                  {a.detail}
                </span>
              )}
            </div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{fmtDate(a.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Bugs relacionados ─────────────────────────────────────────
function RelatedBugsSection({ bugId, relatedBugs, allBugs, onAdd, onRemove, isViewer }) {
  const [adding, setAdding] = useState(false);
  const [selId,  setSelId]  = useState("");
  const relatedIds = (relatedBugs||[]).map(b => String(b.related_bug_id));
  const available  = (allBugs||[]).filter(b => String(b.id) !== String(bugId) && !relatedIds.includes(String(b.id)));

  return (
    <div>
      <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",
        letterSpacing:".05em",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        BUGS RELACIONADOS
        <span style={{background:"var(--border)",color:"var(--text-muted)",borderRadius:12,
          padding:"1px 8px",fontSize:10}}>{relatedBugs?.length||0}</span>
      </div>

      {(relatedBugs||[]).length === 0 && (
        <p style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic",marginBottom:8}}>Nenhum bug relacionado.</p>
      )}

      {(relatedBugs||[]).map(b => (
        <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
          padding:"8px 0",borderBottom:"1px solid var(--border)",gap:8}}>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:12,fontWeight:500,color:"var(--accent)",
              whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              #{b.related_bug_id} · {b.title}
            </div>
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>{b.module_name}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            <BugStatus v={b.status} />
            {!isViewer && (
              <button onClick={()=>onRemove(b.related_bug_id)}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",fontSize:12}}>✕</button>
            )}
          </div>
        </div>
      ))}

      {!isViewer && !adding && (
        <button className="btn btn-sm" style={{marginTop:8,width:"100%"}} onClick={()=>setAdding(true)}>
          + Vincular bug
        </button>
      )}
      {adding && (
        <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
          <select value={selId} onChange={e=>setSelId(e.target.value)}
            style={{flex:1,minWidth:0,padding:"5px 8px",borderRadius:6,
              border:"1px solid var(--border)",fontSize:12}}>
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

// ── Página principal ──────────────────────────────────────────
export default function BugDetail() {
  const { id }             = useParams();
  const navigate           = useNavigate();
  const { user }           = useAuth();
  const { currentProject } = useProject();
  const pid      = currentProject?.id;
  const isViewer = user?.role === "viewer";
  const descRef  = useRef(null);

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

  const fmtDate  = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
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
    // Aguarda render e popula o editor rico de descrição
    setTimeout(() => {
      if (descRef.current) descRef.current.innerHTML = bug.description || "";
    }, 50);
  }

  async function handleSave() {
    setSaving(true); setErr(null);
    try {
      const descHtml = descRef.current?.innerHTML || form.description;
      await bugsApi.update(bug.id, {...form, description: descHtml});
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
      <div className="page-header" style={{flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,flex:1,minWidth:0}}>
          <button className="btn" onClick={()=>navigate("/bugs")} style={{flexShrink:0,marginTop:4}}>
            ← Voltar
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",
              fontWeight:600,marginBottom:4}}>Bug #{bug.id}</div>
            {isEditing ? (
              <input value={form.title} onChange={set("title")} autoFocus
                style={{fontSize:22,fontWeight:500,border:"none",width:"100%",
                  borderBottom:"2px solid var(--accent)",background:"transparent",outline:"none"}} />
            ) : (
              <h1 style={{fontSize:22,margin:0,fontWeight:500,lineHeight:1.3,wordBreak:"break-word"}}>
                {bug.title}
              </h1>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
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

          {/* Descrição com editor rico */}
          <Accordion title="Descrição" defaultOpen={true}>
            {isEditing && (
              <div style={{padding:"8px 16px 0",borderBottom:"1px solid var(--border)"}}>
                <FormatToolbar editorRef={descRef} />
              </div>
            )}
            <div style={{padding:"12px 16px"}}>
              {isEditing ? (
                <div ref={descRef} contentEditable suppressContentEditableWarning
                  data-placeholder="Descreva o bug..."
                  style={{minHeight:80,outline:"none",fontSize:13,lineHeight:1.7}}
                />
              ) : bug.description ? (
                <div style={{fontSize:13,lineHeight:1.7}}
                  dangerouslySetInnerHTML={{__html: bug.description}} />
              ) : (
                <p style={{color:"var(--text-muted)",fontStyle:"italic",fontSize:13}}>Nenhuma descrição.</p>
              )}
            </div>
          </Accordion>

          {/* Passos */}
          <Accordion title="Passos para reproduzir" defaultOpen={true}>
            <div style={{padding:"12px 16px"}}>
              <StepsSection bugId={bug.id} initialSteps={bug.steps}
                isViewer={isViewer} onSaved={refetch} />
            </div>
          </Accordion>

          {/* Comentário geral */}
          {(isEditing || bug.comment) && (
            <Accordion title="Comentário geral" defaultOpen={true}>
              <div style={{padding:"12px 16px"}}>
                {isEditing ? (
                  <textarea value={form.comment} onChange={set("comment")} rows={3}
                    style={{width:"100%",padding:10,borderRadius:8,border:"1px solid var(--border)",
                      fontSize:13,resize:"vertical",background:"var(--bg)"}} />
                ) : (
                  <div style={{fontSize:13,whiteSpace:"pre-line",lineHeight:1.7}}>{bug.comment}</div>
                )}
              </div>
            </Accordion>
          )}

          {/* Comentários */}
          <Accordion title="Comentários" defaultOpen={true} badge={(bug.activity||[]).filter(a=>a.action==="adicionou comentário").length||undefined}>
            <div style={{padding:"14px 16px"}}>
              <CommentsSection bugId={bug.id} currentUser={user} allUsers={users||[]} />
            </div>
          </Accordion>

          {/* Histórico */}
          {bug.activity?.length > 0 && (
            <Accordion title="Histórico de atividades" defaultOpen={false} badge={bug.activity.length}>
              <div style={{padding:"14px 16px"}}>
                <ActivitySection activity={bug.activity} />
              </div>
            </Accordion>
          )}
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Detalhes */}
          <SidebarAccordion title="Detalhes" defaultOpen={true}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* Criado por */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                borderBottom:"1px solid var(--border)",paddingBottom:8,gap:8}}>
                <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>Criado por</span>
                <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                  <Avatar name={bug.created_by_name} size={20} />
                  <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {bug.created_by_name||"—"}
                  </span>
                </div>
              </div>
              {/* Data */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                borderBottom:"1px solid var(--border)",paddingBottom:8}}>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>Data</span>
                <span style={{fontSize:13}}>{fmtDate(bug.created_at)}</span>
              </div>
              {/* Módulo */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                borderBottom:"1px solid var(--border)",paddingBottom:8,gap:8}}>
                <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>Módulo</span>
                {isEditing
                  ? <Select value={form.module_id} onChange={v=>setForm(f=>({...f,module_id:v}))}
                      options={(modules||[]).map(m=>({value:m.id,label:m.name}))} placeholder="—" />
                  : <span style={{fontSize:13}}>{bug.module_name||"—"}</span>}
              </div>
              {/* TC */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                borderBottom:"1px solid var(--border)",paddingBottom:8,gap:8,minWidth:0}}>
                <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>TC</span>
                {isEditing
                  ? <Select value={form.test_case_id} onChange={v=>setForm(f=>({...f,test_case_id:v}))}
                      options={(testCases||[]).map(t=>({value:t.id,label:`#${t.id} ${t.title}`}))} placeholder="—" />
                  : bug.test_case_id
                    ? <span style={{fontSize:12,color:"var(--accent)",fontWeight:500,background:"var(--accent-bg)",
                        padding:"2px 8px",borderRadius:10,overflow:"hidden",textOverflow:"ellipsis",
                        whiteSpace:"nowrap",maxWidth:160}}>
                        TC #{bug.test_case_id}
                      </span>
                    : <span style={{fontSize:13}}>—</span>}
              </div>
              {/* Responsável */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                borderBottom:"1px solid var(--border)",paddingBottom:8,gap:8}}>
                <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>Responsável</span>
                {isEditing
                  ? <Select value={form.assigned_to_id} onChange={v=>setForm(f=>({...f,assigned_to_id:v}))}
                      options={(users||[]).map(u=>({value:u.id,label:u.name}))} placeholder="—" />
                  : bug.assigned_to_name
                    ? <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                        <Avatar name={bug.assigned_to_name} size={20} />
                        <span style={{fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {bug.assigned_to_name}
                        </span>
                      </div>
                    : <span style={{fontSize:13,color:"var(--text-muted)"}}>—</span>}
              </div>
              {/* PR */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>PR</span>
                {isEditing
                  ? <input value={form.pr_url} onChange={set("pr_url")} placeholder="#241 ou URL"
                      style={{width:140,padding:"3px 8px",borderRadius:6,
                        border:"1px solid var(--border)",fontSize:12}} />
                  : bug.pr_url
                    ? <a href={bug.pr_url.startsWith("http")?bug.pr_url:"#"}
                        style={{fontSize:13,color:"var(--accent)",fontWeight:500,
                          textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>
                        {bug.pr_url}
                      </a>
                    : !isViewer
                      ? <button className="btn btn-sm" style={{fontSize:10}} onClick={startEdit}>+ Add</button>
                      : <span style={{fontSize:13,color:"var(--text-muted)"}}>—</span>}
              </div>
            </div>
          </SidebarAccordion>

          {/* Tracker */}
          <SidebarAccordion title="Tracker" defaultOpen={true}>
            {isEditing
              ? <input value={form.tracker_url} onChange={set("tracker_url")} placeholder="https://..."
                  style={{width:"100%",padding:"6px 10px",borderRadius:6,
                    border:"1px solid var(--border)",fontSize:12}} />
              : bug.tracker_url
                ? <a href={bug.tracker_url} target="_blank" rel="noreferrer"
                    style={{color:"var(--accent)",fontSize:12,wordBreak:"break-all",textDecoration:"none"}}>
                    🔗 {bug.tracker_url.replace(/^https?:\/\//,"")}
                  </a>
                : <p style={{color:"var(--text-muted)",fontSize:12,fontStyle:"italic"}}>Nenhum tracker.</p>}
          </SidebarAccordion>

          {/* Anexos */}
          <SidebarAccordion title="Anexos" defaultOpen={true} badge={(bug.evidence_files||[]).length||undefined}>
            {(bug.evidence_files||[]).length === 0 && (
              <p style={{color:"var(--text-muted)",fontSize:12,fontStyle:"italic",marginBottom:10}}>
                Nenhum anexo.
              </p>
            )}
            {(bug.evidence_files||[]).map(f => {
              const apiBase = import.meta.env.VITE_API_URL || "";
              const url     = f.url || `${apiBase}/uploads/${f.filename}`;
              const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(f.filename||"");
              const isVideo = /\.(mp4|webm|mov)$/i.test(f.filename||"");
              const name    = f.originalname || f.filename || "arquivo";
              return (
                <div key={f.id} style={{marginBottom:10,borderBottom:"1px solid var(--border)",paddingBottom:8}}>
                  {isImage && (
                    <a href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={name} style={{width:"100%",borderRadius:8,
                        objectFit:"cover",maxHeight:120,marginBottom:6}} />
                    </a>
                  )}
                  {isVideo && (
                    <video controls style={{width:"100%",borderRadius:8,marginBottom:6}}>
                      <source src={url} />
                    </video>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <a href={url} target="_blank" rel="noreferrer"
                      style={{fontSize:12,color:"var(--accent)",textDecoration:"none",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>
                      📎 {name}
                    </a>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <a href={url} download={name}
                        style={{fontSize:11,color:"var(--text-muted)",textDecoration:"none",
                          padding:"2px 6px",border:"1px solid var(--border)",borderRadius:4}}>
                        ⬇
                      </a>
                      {!isViewer && (
                        <button onClick={()=>handleFileDelete(f.id)}
                          style={{background:"none",border:"1px solid var(--danger)",cursor:"pointer",
                            color:"var(--danger)",fontSize:11,padding:"2px 6px",borderRadius:4}}>✕</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!isViewer && (
              <label style={{display:"block",marginTop:8,cursor:"pointer"}}>
                <div className="btn btn-sm" style={{width:"100%",textAlign:"center",display:"block"}}>
                  + Adicionar arquivo
                </div>
                <input type="file" style={{display:"none"}}
                  onChange={e=>e.target.files[0]&&handleFileUpload(e.target.files[0])} />
              </label>
            )}
          </SidebarAccordion>

          {/* Bugs relacionados */}
          <SidebarAccordion title="Bugs relacionados" defaultOpen={true} badge={(bug.related_bugs||[]).length||undefined}>
            <RelatedBugsSection
              bugId={bug.id}
              relatedBugs={bug.related_bugs}
              allBugs={allBugs}
              onAdd={handleAddRelation}
              onRemove={handleRemoveRelation}
              isViewer={isViewer}
            />
          </SidebarAccordion>

        </div>
      </div>

      {confirm && (
        <ConfirmModal message={`Excluir o bug "${bug.title}"?`}
          onConfirm={handleDelete} onCancel={()=>setConfirm(false)} />
      )}
    </div>
  );
}
