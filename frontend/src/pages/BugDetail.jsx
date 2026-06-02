import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAsync }   from "../hooks/useAsync.js";
import { bugsApi, modulesApi, testCasesApi } from "../services/resources.js";
import { useAuth }    from "../context/AuthContext.jsx";
import { useProject } from "../context/ProjectContext.jsx";
import { FileUpload } from "../components/FileUpload.jsx";
import { Loading, ErrorMsg, Modal, ConfirmModal, Field, Select, Severity, BugStatus } from "../components/UI.jsx";

const SEV_OPTS    = [{value:"low",label:"Baixa"},{value:"medium",label:"Média"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}];
const STATUS_OPTS = [{value:"open",label:"Aberto"},{value:"in_progress",label:"Em andamento"},{value:"fixed",label:"Corrigido"},{value:"closed",label:"Fechado"}];

function BugForm({ initial={}, modules, testCases, onSave, onCancel, saving, bugId, onFileUpload, onFileDelete }) {
  const [form, setForm] = useState({
    title:        initial.title        || "",
    description:  initial.description  || "",
    comment:      initial.comment      || "",
    tracker_url:  initial.tracker_url  || "",
    severity:     initial.severity     || "medium",
    status:       initial.status       || "open",
    module_id:    initial.module_id    || "",
    test_case_id: initial.test_case_id || "",
  });
  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));
  return (
    <>
      <Field label="Título *">
        <input value={form.title} onChange={set("title")} autoFocus />
      </Field>
      <div className="form-row">
        <Field label="Severidade">
          <Select value={form.severity} onChange={v=>setForm(f=>({...f,severity:v}))} options={SEV_OPTS} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={STATUS_OPTS} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Módulo">
          <Select value={form.module_id} onChange={v=>setForm(f=>({...f,module_id:v}))}
            options={modules.map(m=>({value:m.id,label:m.name}))} placeholder="Automático pelo título..." />
        </Field>
        <Field label="Caso de teste vinculado">
          <Select value={form.test_case_id} onChange={v=>setForm(f=>({...f,test_case_id:v}))}
            options={testCases.map(t=>({value:t.id,label:`#${t.id} ${t.title}`}))} placeholder="Nenhum" />
        </Field>
      </div>
      <Field label="Link do tracker">
        <input value={form.tracker_url} onChange={set("tracker_url")} placeholder="https://..." />
      </Field>
      <Field label="Comentário">
        <textarea value={form.comment} onChange={set("comment")} rows={3} />
      </Field>
      <Field label="Descrição">
        <textarea value={form.description} onChange={set("description")} />
      </Field>
      {bugId && (
        <Field label="Arquivos / Evidências">
          <FileUpload files={initial.evidence_files || []} onUpload={onFileUpload} onDelete={onFileDelete} />
        </Field>
      )}
      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving || !form.title.trim()}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}

export default function BugDetail() {
  const { id }             = useParams();
  const navigate           = useNavigate();
  const { user }           = useAuth();
  const { currentProject } = useProject();
  const pid      = currentProject?.id;
  const isViewer = user?.role === "viewer";

  const { data: bug,       loading: l1, error: e1, refetch } = useAsync(() => bugsApi.get(id), [id]);
  const { data: modules }  = useAsync(() => modulesApi.list(pid ? {project_id:pid} : {}), [pid]);
  const { data: testCases }= useAsync(() => testCasesApi.list(pid ? {project_id:pid} : {}), [pid]);

  const [editing,  setEditing]  = useState(false);
  const [confirm,  setConfirm]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState(null);

  if (l1) return <Loading />;
  if (e1 || !bug) return <ErrorMsg msg={e1 || "Bug não encontrado"} />;

  const fmtDate = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  async function handleSave(form) {
    setSaving(true); setErr(null);
    try {
      await bugsApi.update(bug.id, form);
      setEditing(false);
      refetch();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(file) {
    const fd = new FormData(); fd.append("file", file);
    const token = localStorage.getItem("qa_token");
    await fetch(`/api/bugs/${bug.id}/files`, {
      method:"POST", body:fd, headers: token ? {Authorization:`Bearer ${token}`} : {},
    });
    refetch();
  }

  async function handleFileDelete(fileId) {
    const token = localStorage.getItem("qa_token");
    await fetch(`/api/bugs/${bug.id}/files/${fileId}`, {
      method:"DELETE", headers: token ? {Authorization:`Bearer ${token}`} : {},
    });
    refetch();
  }

  async function handleDelete() {
    try {
      await bugsApi.delete(bug.id);
      navigate("/bugs");
    } catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="btn" onClick={() => navigate("/bugs")}>← Voltar</button>
          <div>
            <div style={{fontSize:12,color:"var(--text-muted)"}}>Bug #{bug.id}</div>
            <h1 style={{fontSize:18,margin:0}}>{bug.title}</h1>
          </div>
        </div>
        {!isViewer && (
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={() => setEditing(true)}>✏ Editar</button>
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>🗑 Excluir</button>
          </div>
        )}
      </div>

      {err && <ErrorMsg msg={err} />}

      {/* Badges */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <Severity v={bug.severity} />
        <BugStatus v={bug.status} />
        {bug.module_name && (
          <span className="badge badge-active">{bug.module_name}</span>
        )}
        {bug.test_case_id && (
          <span style={{fontSize:12,color:"var(--accent)",fontWeight:600}}>TC #{bug.test_case_id}</span>
        )}
      </div>

      {/* Grid de infos */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Criado por", value: bug.created_by_name || "—"},
          {label:"Data",       value: fmtDate(bug.created_at)},
          {label:"Módulo",     value: bug.module_name || "—"},
          {label:"Caso de TC", value: bug.test_case_id ? `#${bug.test_case_id}` : "—"},
        ].map(({label,value}) => (
          <div key={label} className="card" style={{padding:"12px 16px",marginBottom:0}}>
            <div style={{fontSize:10,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",marginBottom:4}}>{label}</div>
            <div style={{fontSize:14,fontWeight:500}}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tracker */}
      {bug.tracker_url && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",marginBottom:8}}>Tracker</div>
          <a href={bug.tracker_url} target="_blank" rel="noreferrer"
            style={{color:"var(--accent)",fontSize:14,wordBreak:"break-all"}}>
            🔗 {bug.tracker_url}
          </a>
        </div>
      )}

      {/* Comentário */}
      {bug.comment && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",marginBottom:8}}>Comentário</div>
          <div style={{fontSize:14,whiteSpace:"pre-line",lineHeight:1.6}}>{bug.comment}</div>
        </div>
      )}

      {/* Descrição */}
      {bug.description && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",marginBottom:8}}>Descrição</div>
          <div style={{fontSize:14,whiteSpace:"pre-line",lineHeight:1.6}}>{bug.description}</div>
        </div>
      )}

      {/* Evidências */}
      {bug.evidence_files?.length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",marginBottom:12}}>Arquivos / Evidências</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {bug.evidence_files.map(f => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                style={{fontSize:13,color:"var(--accent)",background:"var(--accent-bg)",
                  padding:"6px 14px",borderRadius:8,textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
                📎 {f.name || f.filename || "arquivo"}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editing && (
        <Modal title={`Editar Bug #${bug.id}`} onClose={() => setEditing(false)}>
          <BugForm
            initial={bug}
            modules={modules||[]}
            testCases={testCases||[]}
            bugId={bug.id}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            saving={saving}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
          />
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          message={`Excluir o bug "${bug.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
