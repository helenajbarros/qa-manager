import { useState, useRef, useEffect, useMemo, ChangeEvent, KeyboardEvent, RefObject } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAsync }   from "../hooks/useAsync.js";
import { bugsApi, modulesApi, testCasesApi, usersApi, environmentsApi } from "../services/resources.js";
import { useAuth }    from "../context/AuthContext.js";
import { useProject } from "../context/ProjectContext.js";
import { Loading, ErrorMsg, ConfirmModal, Field, Select, Severity, BugStatus } from "../components/UI.js";
import type { Bug, Module, TestCase, MentionUser, Comment, EvidenceFile } from "../types/index.js";

// ── Local interfaces ──────────────────────────────────────────
interface AvatarProps { name?: string; size?: number; }
interface AccordionProps { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode; }
interface StepsSectionProps { steps: string[]; onChange: (steps: string[]) => void; isViewer: boolean; }
interface CommentsSectionProps { bugId: number; currentUser: { id: number; name: string } | null; bug: Bug | null; }
interface ActivityEntry { user_name?: string; action: string; detail?: string; created_at: string; }
interface ActivitySectionProps { activity: ActivityEntry[]; }
interface RelatedBug extends Bug { title: string; }
interface RelatedBugsSectionProps {
  bugId: number;
  relatedBugs: RelatedBug[];
  allBugs: Bug[];
  onAdd: (id: string) => void;
  onRemove: (id: number) => void;
  isViewer: boolean;
}

interface BugFormState {
  title: string;
  description: string;
  steps_to_reproduce: string | string[];
  expected_result: string;
  actual_result: string;
  severity: string;
  status: string;
  module_id: string | number;
  test_case_id: string | number;
  assigned_to_id: string | number;
  test_type: string;
  tracker_url?: string;
  pr_url?: string;
  os?: string;
  browser?: string;
  impact?: string;
  evidence_url?: string;
}

const TEST_TYPES = [
  "Funcional","Regressão","Integração","Performance","Segurança",
  "Usabilidade","Smoke","Sanidade","Exploratório","Aceitação","API","Automação"
];

const OS_OPTS      = ["Windows","macOS","Linux","Android","iOS"].map(v=>({value:v,label:v}));
const BROWSER_OPTS = ["Chrome","Firefox","Safari","Edge","Opera"].map(v=>({value:v,label:v}));

function detectOS(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Win/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "";
}
function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua)) return "Safari";
  return "";
}

const SEV_OPTS    = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const PRIO_OPTS   = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const ENV_OPTS    = [{value:"production",label:"Produção"},{value:"homologation",label:"Homologação"},{value:"staging",label:"Staging"},{value:"development",label:"Desenvolvimento"}];
const STATUS_OPTS = [{value:"open",label:"Aberto"},{value:"in_progress",label:"Em andamento"},{value:"fixed",label:"Corrigido"},{value:"closed",label:"Fechado"}];
const ACT_ICONS   = {"criou o bug":"🐛","alterou o status":"🔄","alterou o responsável":"👤","editou o bug":"✏","adicionou passo":"➕","removeu passo":"➖"};

function getBase() {
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";
}
function getToken() { return localStorage.getItem("qa_token"); }

function Avatar({ name, size = 30 }: AvatarProps) {
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
function Accordion({ title, children, defaultOpen = true, badge }: AccordionProps) {
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

function SidebarAccordion({ title, children, defaultOpen = true, badge }: AccordionProps) {
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

// ── Passos editáveis ─────────────────────────────────────────
function StepsSection({ steps, onChange, isViewer }: StepsSectionProps) {
  const [localList, setLocalList] = useState(() => {
    const raw = steps ? steps.split("\n") : [];
    return isViewer ? raw.filter(s => s.trim()) : (raw.length ? raw : []);
  });

  function updateStep(i: number, val: string) {
    const next = [...localList]; next[i] = val;
    setLocalList(next);
    onChange(next.join("\n"));
  }
  function addStep() {
    const next = [...localList, ""];
    setLocalList(next);
    onChange(next.join("\n"));
    setTimeout(() => {
      const inputs = document.querySelectorAll(".step-input");
      if (inputs[inputs.length-1]) inputs[inputs.length-1].focus();
    }, 50);
  }
  function removeStep(i: number) {
    const next = localList.filter((_, idx) => idx !== i);
    setLocalList(next);
    onChange(next.join("\n"));
  }
  const list = localList;

  return (
    <div>
      {list.length === 0 && (
        <p style={{fontSize:13,color:"var(--text-muted)",fontStyle:"italic",marginBottom:12}}>
          Nenhum passo adicionado.
        </p>
      )}
      {list.map((step, i) => (
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
                if (e.key === "Enter") { e.preventDefault(); addStep(); }
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
    </div>
  );
}

// ── Comentários ───────────────────────────────────────────────
function renderWithMentions(text: string, allUsers: MentionUser[]) {
  if (!text || !allUsers || !allUsers.length) return text;
  const validUsers = allUsers.filter(function(u) { return u.name && u.name.trim().length > 0; });
  if (!validUsers.length) return text;
  const result = [];
  let remaining = text;
  let key = 0;
  validUsers.forEach(function(u) {
    const mention = "@" + u.name.trim();
    const idx2 = remaining.toLowerCase().indexOf(mention.toLowerCase());
    if (idx2 >= 0) {
      if (idx2 > 0) result.push(remaining.slice(0, idx2));
      result.push(
        <span key={key++} style={{background:"#EFF6FF",color:"#2563EB",
          borderRadius:4,padding:"1px 6px",fontWeight:500}}>
          {remaining.slice(idx2, idx2 + mention.length)}
        </span>
      );
      remaining = remaining.slice(idx2 + mention.length);
    }
  });
  if (remaining) result.push(remaining);
  return result.length > 0 ? result : text;
}

function CommentsSection({ bugId, currentUser, bug }: CommentsSectionProps) {
  const { data: comments, refetch } = useAsync(async () => {
    const res = await fetch(`${getBase()}/bugs/${bugId}/comments`,{
      headers:{Authorization:`Bearer ${getToken()}`}
    });
    const j = await res.json();
    return j.data ?? j ?? [];
  }, [bugId]);

  const [allUsers, setAllUsers] = useState<MentionUser[]>([]);

  useEffect(() => {
    if (allUsers.length > 0) return;
    let cancelled = false;
    async function fetchUsers() {
      try {
        const res = await fetch(`${getBase()}/users/mentions`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        const j = await res.json();
        const data = j.data ?? j ?? [];
        if (!cancelled && Array.isArray(data) && data.length > 0) setAllUsers(data);
        else if (!cancelled) setTimeout(fetchUsers, 3000);
      } catch(e) {
        if (!cancelled) setTimeout(fetchUsers, 3000);
      }
    }
    fetchUsers();
    return () => { cancelled = true; };
  }, []);



  const editorRef   = useRef(null);
  const [saving,    setSaving]    = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [editText,  setEditText]  = useState("");

  const [showMention,setShowMention]=useState(false);
  const [mentionQ,  setMentionQ]  = useState("");

  const fmtDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };

  function handleInput(e: React.FormEvent) {
    const txt = editorRef.current?.innerText || "";
    const at  = txt.lastIndexOf("@");
    if (at >= 0) {
      const q = txt.slice(at+1);
      setMentionQ(q.trimStart()); setShowMention(true); return;
    }
    setShowMention(false);
  }

  function insertMention(name: string) {
    const el = editorRef.current;
    if (!el) return;
    const txt    = el.innerText;
    const at     = txt.lastIndexOf("@");
    const before = txt.slice(0, at);
    const chip   = document.createElement("span");
    chip.style.cssText = "background:#EFF6FF;color:#2563EB;border-radius:4px;padding:1px 6px;font-weight:500";
    chip.textContent   = `@${name}`;
    chip.contentEditable = "false";
    el.innerHTML = "";
    el.appendChild(document.createTextNode(before));
    el.appendChild(document.createTextNode(" "));
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

  async function handleEdit(id: number) {
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

  async function handleDelete(id: number) {
    await fetch(`${getBase()}/bugs/${bugId}/comments/${id}`,{
      method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  const isAdmin = (currentUser as any)?.role === "admin";

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
                    <button onClick={()=>{ if(window.confirm("Excluir este comentário?")) handleDelete(c.id); }}
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
                  background:"var(--bg)",padding:"10px 14px",borderRadius:8}}>{renderWithMentions(c.text, allUsers)}</div>
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
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
              background:"#ffffff",border:"1px solid #E5E7EB",borderRadius:8,
              zIndex:9999,maxHeight:200,overflowY:"auto",
              boxShadow:"0 8px 24px rgba(0,0,0,.15)"}}>
              <div style={{padding:"6px 10px",fontSize:11,color:"#6B7280",
                borderBottom:"1px solid #E5E7EB"}}>
                Mencionar membro
              </div>
              {filteredUsers.map(u => (
                <div key={u.id}
                  onMouseDown={(e)=>{ e.preventDefault(); insertMention(u.name); }}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                    cursor:"pointer",fontSize:13,transition:"background .15s",
                    background:"#ffffff",color:"#111827"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#F3F4F6"}
                  onMouseLeave={e=>e.currentTarget.style.background="#ffffff"}>
                  <Avatar name={u.name} size={24} />
                  <span style={{fontWeight:500}}>{u.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar comentários */}
          <div style={{display:"flex",gap:4,padding:"4px 0",flexWrap:"wrap"}}>
            {[["B","bold","fontWeight:700"],["I","italic","fontStyle:italic"],["U","underline","textDecoration:underline"]].map(([label,cmd,style])=>(
              <button key={cmd}
                onClick={()=>{editorRef.current?.focus();document.execCommand(cmd,false,null);}}
                style={{background:"none",border:"1px solid var(--border)",borderRadius:6,
                  cursor:"pointer",padding:"3px 8px",fontSize:12,color:"var(--text-muted)",fontFamily:"inherit"}}>
                <span style={{[style.split(":")[0]]:style.split(":")[1]}}>{label}</span>
              </button>
            ))}
            <button onClick={()=>{
              const el=editorRef.current;
              if(el){el.focus();document.execCommand("insertText",false,"@");setShowMention(true);setMentionQ("");}
            }} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,
              cursor:"pointer",padding:"3px 8px",fontSize:12,color:"var(--text-muted)",fontFamily:"inherit"}}>@</button>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
            <span style={{fontSize:11,color:"var(--text-muted)"}}>@ Digite @ para mencionar um membro</span>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving} style={{fontSize:12}}>
              {saving?"Enviando…":"✈ Comentar"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Histórico ─────────────────────────────────────────────────
function ActivitySection({ activity }: ActivitySectionProps) {
  if (!activity?.length) return null;
  const fmtDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " às " + dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  };
  const dotColors = {
    "criou o bug":       "#6B7280",
    "alterou o status":  "#16A34A",
    "alterou o responsável": "#2563EB",
    "editou o bug":      "#D97706",
    "adicionou comentário": "#7C3AED",
    "adicionou passo":   "#0891B2",
    "removeu passo":     "#DC2626",
    "arquivou o ciclo":  "#6B7280",
    "arquivou o bug":    "#6B7280",
    "desarquivou o bug": "#2563EB",
  };
  const icons = {
    "criou o bug":       "🐛",
    "alterou o status":  "🔄",
    "alterou o responsável": "👤",
    "editou o bug":      "✏️",
    "adicionou comentário": "💬",
    "adicionou passo":   "➕",
    "removeu passo":     "➖",
    "arquivou o ciclo":  "📦",
    "arquivou o bug":    "📦",
    "desarquivou o bug": "🔓",
  };
  return (
    <div style={{position:"relative",paddingLeft:28}}>
      {/* Linha vertical da timeline */}
      <div style={{position:"absolute",left:9,top:6,bottom:6,width:2,
        background:"var(--border)",borderRadius:2}} />

      {activity.map((a,i) => {
        const color = dotColors[a.action] || "#6B7280";
        const icon  = icons[a.action] || "📋";
        return (
          <div key={a.id||i} style={{position:"relative",marginBottom:i<activity.length-1?20:0}}>
            {/* Bolinha na linha do tempo */}
            <div style={{position:"absolute",left:-28,top:2,width:20,height:20,
              borderRadius:"50%",background:color+"20",border:"1.5px solid "+color+"60",
              display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,flexShrink:0}}>
              <span>{icon}</span>
            </div>

            {/* Conteúdo */}
            <div style={{background:"var(--card)",border:"1px solid var(--border)",
              borderRadius:8,padding:"10px 14px",marginLeft:4}}>
              <div style={{fontSize:13,lineHeight:1.5,display:"flex",flexWrap:"wrap",
                alignItems:"center",gap:4}}>
                <span style={{fontWeight:600,color:"var(--text)"}}>{a.user_name||"Sistema"}</span>
                <span style={{color:"var(--text-muted)"}}>{a.action}</span>
                {a.detail && (
                  <span style={{fontSize:11,color:color,
                    background:color+"15",padding:"2px 8px",borderRadius:10,fontWeight:500}}>
                    {a.detail
                      .replace(/open/g,"Aberto")
                      .replace(/in_progress/g,"Em andamento")
                      .replace(/fixed/g,"Corrigido")
                      .replace(/closed/g,"Fechado")
                      .replace(/active/g,"Ativo")
                      .replace(/completed/g,"Concluído")
                      .replace(/archived/g,"Arquivado")}
                  </span>
                )}
              </div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4,
                display:"flex",alignItems:"center",gap:4}}>
                🕐 {fmtDate(a.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bugs relacionados ─────────────────────────────────────────
function RelatedBugsSection({ bugId, relatedBugs, allBugs, onAdd, onRemove, isViewer }: RelatedBugsSectionProps) {
  const [adding, setAdding] = useState(false);
  const [selId,  setSelId]  = useState<string>("");
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
  const isViewer  = user?.role === "viewer";
  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: bug,        loading: l1, error: e1, refetch } = useAsync(() => bugsApi.get(id), [id]);
  const { data: modules }   = useAsync(() => modulesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: testCases } = useAsync(() => testCasesApi.list(pid?{project_id:pid}:{}), [pid]);
  const { data: users, refetch: refetchUsers } = useAsync(() => usersApi.mentions().catch(() => usersApi.list()), []);
  const { data: allBugs }   = useAsync(() => bugsApi.list(pid?{project_id:pid}:{}), [pid]);
  const bugPid = (bug as any)?.project_id || pid;
  const [envOpts, setEnvOpts] = useState<{value:string,label:string,color:string}[]>([]);
  useEffect(() => {
    if (!bugPid) return;
    environmentsApi.list(bugPid).then((res:any) => {
      const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setEnvOpts(arr.map((e:any) => ({ value: String(e.id), label: e.name, color: e.color })));
    }).catch(() => {});
  }, [bugPid]);

  useEffect(() => {
    if (!users || users.length === 0) {
      const t = setTimeout(() => refetchUsers(), 3000);
      return () => clearTimeout(t);
    }
  }, [users]);

  const [form,       setForm]       = useState<BugFormState | null>(null);
  const [confirm,    setConfirm]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState<string | null>(null);
  const [shareUrl,   setShareUrl]   = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  if (l1) return <Loading />;
  if (e1 || !bug) return <ErrorMsg msg={e1||"Bug não encontrado"} />;

  const fmtDate  = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const isEditing = !!form;

  function startEdit() {
    setForm({
      title:          bug.title          || "",
      description:    bug.description    || "",
      comment:        bug.comment        || "",
      tracker_url:    bug.tracker_url    || "",
      pr_url:         bug.pr_url         || "",
      os:             (bug as any).os           || detectOS(),
      browser:        (bug as any).browser      || detectBrowser(),
      impact:         (bug as any).impact        || "",
      evidence_url:   (bug as any).evidence_url  || "",
      severity:       bug.severity       || "medium",
      priority:       bug.priority       || "medium",
      status:         bug.status         || "open",
      module_id:      bug.module_id      || "",
      test_case_id:   bug.test_case_id   || "",
      assigned_to_id: bug.assigned_to_id || "",
      steps:          bug.steps          || "",
      test_type:      bug.test_type      || "",
      environment:    bug.environment    || null,
      environment_id: bug.environment_id || null,
      actual_result:  bug.actual_result  || "",
      expected_result: bug.expected_result || "",
    });
  }

  async function handleSave() {
    setSaving(true); setErr(null);
    try {
      await bugsApi.update(bug.id, {...form});
      setForm(null);
      refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(file: File) {
    const fd = new FormData(); fd.append("file", file);
    await fetch(`${getBase()}/bugs/${bug.id}/files`,{
      method:"POST",body:fd,headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  async function handleFileDelete(fileId: number) {
    await fetch(`${getBase()}/bugs/${bug.id}/files/${fileId}`,{
      method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  async function handleAddRelation(relatedId: string) {
    await fetch(`${getBase()}/bugs/${bug.id}/relations`,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${getToken()}`},
      body:JSON.stringify({related_bug_id:relatedId})
    });
    refetch();
  }

  async function handleRemoveRelation(relatedId: number) {
    await fetch(`${getBase()}/bugs/${bug.id}/relations/${relatedId}`,{
      method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}
    });
    refetch();
  }

  async function handleDelete() {
    try { await bugsApi.delete(bug.id); navigate("/bugs"); }
    catch(e) { setErr(e.message); }
  }

  async function handleArchive() {
    if (!window.confirm("Arquivar este bug? Ele ficará oculto na aba Finalizados e só será visível ao marcar 'Mostrar bugs de ciclos arquivados'.")) return;
    try {
      await bugsApi.update(bug.id, {
        title: bug.title,
        description: bug.description || "",
        comment: bug.comment || "",
        tracker_url: bug.tracker_url || "",
        pr_url: bug.pr_url || "",
        severity: bug.severity || "medium",
        priority: bug.priority || "medium",
        status: "closed",
        module_id: bug.module_id || "",
        test_case_id: bug.test_case_id || "",
        assigned_to_id: bug.assigned_to_id || "",
        steps: bug.steps || "",
        environment: bug.environment || null,
        environment_id: bug.environment_id || null,
        actual_result: bug.actual_result || "",
        expected_result: bug.expected_result || "",
        closed_by_archive: true,
      });
      navigate("/bugs", { state: { refresh: Date.now() } });
    } catch(e) { setErr(e.message); }
  }

  async function handleUnarchive() {
    if (!window.confirm("Desarquivar este bug? Ele voltará a aparecer normalmente na aba Finalizados.")) return;
    try {
      await bugsApi.update(bug.id, {
        title: bug.title,
        description: bug.description || "",
        comment: bug.comment || "",
        tracker_url: bug.tracker_url || "",
        pr_url: bug.pr_url || "",
        severity: bug.severity || "medium",
        priority: bug.priority || "medium",
        status: bug.status || "closed",
        module_id: bug.module_id || "",
        test_case_id: bug.test_case_id || "",
        assigned_to_id: bug.assigned_to_id || "",
        steps: bug.steps || "",
        environment: bug.environment || null,
        environment_id: bug.environment_id || null,
        actual_result: bug.actual_result || "",
        expected_result: bug.expected_result || "",
        closed_by_archive: false,
      });
      navigate("/bugs", { state: { refresh: Date.now() } });
    } catch(e) { setErr(e.message); }
  }

  async function handleShare() {
    setShareLoading(true);
    try {
      const res = await fetch(`${getBase()}/bugs/${bug.id}/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const j = await res.json();
      const token = j.data?.token ?? j.token;
      const base = window.location.origin + "/qa-manager";
      const url  = `${base}/share/${token}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).catch(()=>{});
      setTimeout(() => setShareUrl(null), 5000);
    } catch(e) { setErr("Erro ao gerar link"); }
    finally { setShareLoading(false); }
  }

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm((f: any) => f ? ({...f, [k]: e.target.value}) : f);

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
              <button className="btn" onClick={handleShare} disabled={shareLoading}
                title="Gerar link público de visualização"
                style={{fontSize:12}}>
                {shareLoading ? "Gerando..." : "🔗 Link público"}
              </button>
              <button className="btn" onClick={startEdit}>✏ Editar</button>
              {["fixed","closed"].includes(bug.status) && !bug.closed_by_archive && (
                <button className="btn" onClick={handleArchive}
                  title="Arquivar bug — oculta da listagem padrão"
                  style={{color:"var(--text-muted)",borderColor:"var(--border)"}}>
                  📦 Arquivar
                </button>
              )}
              {bug.closed_by_archive && (
                <button className="btn" onClick={handleUnarchive}
                  title="Desarquivar bug — volta a aparecer na listagem"
                  style={{color:"var(--accent)",borderColor:"var(--accent)"}}>
                  🔓 Desarquivar
                </button>
              )}
              {canManage && (
                <button className="btn btn-danger" onClick={()=>setConfirm(true)}>🗑 Excluir</button>
              )}
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
            <Field label="Prioridade"><Select value={form.priority} onChange={v=>setForm(f=>({...f,priority:v}))} options={PRIO_OPTS} /></Field>
            <Field label="Ambiente"><Select value={String(form.environment_id||'')} onChange={v=>{ const env=envOpts.find(e=>e.value===v); setForm(f=>({...f,environment_id:v?Number(v):null,environment:env?.label||null})); }} options={envOpts.length>0?envOpts:[{value:"production",label:"Produção"},{value:"homologation",label:"Homologação"},{value:"staging",label:"Staging"},{value:"development",label:"Desenvolvimento"}]} /></Field>
            <select value={form.test_type||""} onChange={e=>setForm(f=>({...f,test_type:e.target.value}))}
              style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--border)",
                fontSize:12,background:"var(--surface)",color:"var(--text)"}}>
              <option value="">Tipo de teste...</option>
              {TEST_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </>
        ) : (
          <>
            <BugStatus v={bug.status} />
            <Severity  v={bug.severity} />
            {bug.priority && <><span style={{color:"var(--text-muted)",fontSize:12}}>Prioridade:</span> <strong>{bug.priority === "low" ? "Baixa" : bug.priority === "medium" ? "Média" : bug.priority === "high" ? "Alta" : "Crítica"}</strong></>}
            {(bug.environment_name || bug.environment) && <><span style={{color:"var(--text-muted)",fontSize:12,marginLeft:8}}>Ambiente:</span> <strong>{bug.environment_name || bug.environment}</strong></>}
            {bug.module_name && <span className="badge badge-active">{bug.module_name}</span>}
            {bug.test_type && (
              <span style={{fontSize:11,padding:"2px 10px",borderRadius:10,
                background:"var(--accent-bg)",color:"var(--accent)",fontWeight:500}}>
                🧪 {bug.test_type}
              </span>
            )}
            {(bug as any).os && (
              <span style={{fontSize:11,padding:"2px 10px",borderRadius:10,
                background:"var(--bg)",border:"1px solid var(--border)",color:"var(--text-muted)"}}>
                💻 {(bug as any).os}
              </span>
            )}
            {(bug as any).browser && (
              <span style={{fontSize:11,padding:"2px 10px",borderRadius:10,
                background:"var(--bg)",border:"1px solid var(--border)",color:"var(--text-muted)"}}>
                🌐 {(bug as any).browser}
              </span>
            )}
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
          <Accordion title="Descrição" defaultOpen={true}>
            <div style={{padding:"12px 16px"}}>
              {isEditing ? (
                <textarea value={form.description||""} onChange={set("description")}
                  rows={5} placeholder="Descreva o bug..."
                  style={{width:"100%",padding:"10px",borderRadius:8,
                    border:"1px solid var(--border)",fontSize:13,lineHeight:1.7,
                    resize:"vertical",background:"var(--bg)",fontFamily:"inherit",
                    outline:"none"}} />
              ) : bug.description ? (
                <div style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",
                  paddingLeft:4,wordBreak:"break-word"}}
                  className="description-content">
                  {bug.description.includes("<") && bug.description.includes(">")
                    ? <span dangerouslySetInnerHTML={{__html: bug.description}} />
                    : bug.description}
                </div>
              ) : (
                <p style={{color:"var(--text-muted)",fontStyle:"italic",fontSize:13}}>Nenhuma descrição.</p>
              )}
              <style>{`
                .description-content ul,
                .description-content ol {
                  padding-left: 20px;
                  margin: 6px 0;
                }
                .description-content li {
                  margin-bottom: 4px;
                  line-height: 1.7;
                }
                .description-content p {
                  margin: 0 0 8px;
                }
                .description-content code {
                  background: var(--bg);
                  border: 1px solid var(--border);
                  border-radius: 4px;
                  padding: 1px 5px;
                  font-family: monospace;
                  font-size: 12px;
                  color: #B5451B;
                }
              `}</style>
            </div>
          </Accordion>

          {/* Passos */}
          <Accordion title="Passos para reproduzir" defaultOpen={true}>
            <div style={{padding:"12px 16px"}}>
              {isEditing ? (
                <StepsSection
                  steps={form.steps}
                  onChange={v => setForm(f=>({...f, steps:v}))}
                  isViewer={false}
                />
              ) : (
                <StepsSection
                  steps={bug.steps}
                  onChange={()=>{}}
                  isViewer={true}
                />
              )}
            </div>
          </Accordion>

          {/* Resultado Obtido */}
          <Accordion title="Resultado obtido" defaultOpen={true}>
            <div style={{padding:"12px 16px"}}>
              {isEditing ? (
                <textarea value={form.actual_result||""} onChange={set("actual_result")}
                  rows={3} placeholder="O que aconteceu de fato? Ex: Sistema retornou erro 500."
                  style={{width:"100%",padding:"10px",borderRadius:8,
                    border:"1px solid var(--border)",fontSize:13,lineHeight:1.7,
                    resize:"vertical",background:"var(--bg)",fontFamily:"inherit",outline:"none"}} />
              ) : bug.actual_result ? (
                <p style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",paddingLeft:4}}>{bug.actual_result}</p>
              ) : (
                <p style={{color:"var(--text-muted)",fontStyle:"italic",fontSize:13}}>Não informado.</p>
              )}
            </div>
          </Accordion>

          {/* Resultado Esperado */}
          <Accordion title="Resultado esperado" defaultOpen={true}>
            <div style={{padding:"12px 16px"}}>
              {isEditing ? (
                <textarea value={form.expected_result||""} onChange={set("expected_result")}
                  rows={3} placeholder="O que deveria acontecer? Ex: Sistema exibe mensagem de sucesso."
                  style={{width:"100%",padding:"10px",borderRadius:8,
                    border:"1px solid var(--border)",fontSize:13,lineHeight:1.7,
                    resize:"vertical",background:"var(--bg)",fontFamily:"inherit",outline:"none"}} />
              ) : bug.expected_result ? (
                <p style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",paddingLeft:4}}>{bug.expected_result}</p>
              ) : (
                <p style={{color:"var(--text-muted)",fontStyle:"italic",fontSize:13}}>Não informado.</p>
              )}
            </div>
          </Accordion>

          {/* Impacto */}
          {((isEditing && form) || (bug as any).impact) && (
            <Accordion title="Impacto no negócio" defaultOpen={true}>
              <div style={{padding:"12px 16px"}}>
                {isEditing ? (
                  <textarea value={(form as any).impact||""} onChange={set("impact")} rows={2}
                    placeholder="Ex: Novos clientes não podem ser cadastrados..."
                    style={{width:"100%",padding:"10px",borderRadius:8,border:"1px solid var(--border)",
                      fontSize:13,lineHeight:1.7,resize:"vertical",background:"var(--bg)",
                      fontFamily:"inherit",outline:"none"}} />
                ) : (
                  <p style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap",paddingLeft:4}}>
                    {(bug as any).impact}
                  </p>
                )}
              </div>
            </Accordion>
          )}

          {/* Comentários */}
          <Accordion title="Comentários" defaultOpen={true} badge={(bug.activity||[]).filter(a=>a.action==="adicionou comentário").length||undefined}>
            <div style={{padding:"14px 16px"}}>
              <CommentsSection bugId={bug.id} currentUser={user} bug={bug} />
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
              {/* SO e Navegador */}
              {((bug as any).os || (bug as any).browser || isEditing) && (<>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  borderBottom:"1px solid var(--border)",paddingBottom:8,gap:8}}>
                  <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>SO</span>
                  {isEditing
                    ? <select value={(form as any).os||""} onChange={e=>setForm((f:any)=>({...f,os:e.target.value}))}
                        style={{padding:"3px 8px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}}>
                        <option value="">—</option>
                        {["Windows","macOS","Linux","Android","iOS"].map(o=><option key={o}>{o}</option>)}
                      </select>
                    : <span style={{fontSize:13}}>{(bug as any).os||"—"}</span>}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  borderBottom:"1px solid var(--border)",paddingBottom:8,gap:8}}>
                  <span style={{fontSize:11,color:"var(--text-muted)",flexShrink:0}}>Navegador</span>
                  {isEditing
                    ? <select value={(form as any).browser||""} onChange={e=>setForm((f:any)=>({...f,browser:e.target.value}))}
                        style={{padding:"3px 8px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}}>
                        <option value="">—</option>
                        {["Chrome","Firefox","Safari","Edge","Opera"].map(o=><option key={o}>{o}</option>)}
                      </select>
                    : <span style={{fontSize:13}}>{(bug as any).browser||"—"}</span>}
                </div>
              </>)}

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

          {/* Link de Evidência */}
          {((isEditing && form) || (bug as any).evidence_url) && (
            <SidebarAccordion title="Link de Evidência" defaultOpen={true}>
              {isEditing
                ? <input value={(form as any).evidence_url||""} onChange={set("evidence_url")}
                    placeholder="https://drive.google.com/..."
                    style={{width:"100%",padding:"6px 10px",borderRadius:6,
                      border:"1px solid var(--border)",fontSize:12}} />
                : <a href={(bug as any).evidence_url} target="_blank" rel="noreferrer"
                    style={{color:"var(--accent)",fontSize:12,wordBreak:"break-all",textDecoration:"none"}}>
                    🎥 {(bug as any).evidence_url?.replace(/^https?:\/\//,"")}
                  </a>}
            </SidebarAccordion>
          )}

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
                  onChange={e=>e.target.files?.[0]&&handleFileUpload(e.target.files[0])} />
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

      {/* Toast do link público */}
      {shareUrl && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          background:"#1E293B",color:"white",borderRadius:10,padding:"12px 20px",
          fontSize:13,zIndex:999,display:"flex",alignItems:"center",gap:12,
          boxShadow:"0 4px 20px rgba(0,0,0,.2)",maxWidth:480,width:"90%"}}>
          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            ✅ Link copiado! <span style={{color:"#93C5FD"}}>{shareUrl}</span>
          </span>
          <button onClick={()=>setShareUrl(null)}
            style={{background:"none",border:"none",color:"white",cursor:"pointer",fontSize:16,
              flexShrink:0}}>✕</button>
        </div>
      )}

      {confirm && (
        <ConfirmModal message={`Excluir o bug "${bug.title}"?`}
          onConfirm={handleDelete} onCancel={()=>setConfirm(false)} />
      )}
    </div>
  );
}


