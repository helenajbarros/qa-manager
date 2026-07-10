import { useState, useRef, ChangeEvent } from "react";
import { useAsync }     from "../hooks/useAsync.js";
import { projectsApi }  from "../services/resources.js";
import { useProject }   from "../context/ProjectContext.js";
import { useAuth }      from "../context/AuthContext.js";
import { Loading, ErrorMsg, Empty, Modal, ConfirmModal, Field } from "../components/UI.js";
import { environmentsApi } from "../services/resources.js";
import type { Project } from "../types/index.js";

interface ProjectFormData {
  name: string;
  description: string;
}

interface ProjectWithStats extends Project {
  module_count?: number;
  cycle_count?: number;
  bug_count?: number;
  active?: boolean;
}

interface ProjectFormProps {
  initial?: Partial<ProjectWithStats>;
  onSave: (form: ProjectFormData, logoFile: File | null) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  onLogoUpload?: (id: number, file: File) => void;
}

type ModalState = { mode: "create"; item?: null } | { mode: "edit"; item: ProjectWithStats };

function ProjectForm({ initial = {}, onSave, onCancel, saving }: ProjectFormProps) {
  const [form,       setForm]       = useState({ name: initial.name||"", description: initial.description||"" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial.logo_url || null);
  const [logoFile,   setLogoFile]   = useState<File | null>(null);
  const set = (k: keyof ProjectFormData) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({...f, [k]: e.target.value}));

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    await onSave(form, logoFile);
  }

  return (
    <>
      <Field label="Nome *">
        <input value={form.name} onChange={set("name")} autoFocus placeholder="Ex: Portal do Cliente" />
      </Field>
      <Field label="Descrição">
        <textarea value={form.description} onChange={set("description")} placeholder="Descrição do projeto..." />
      </Field>

      {/* Upload de logo */}
      <Field label="Logo do projeto">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {previewUrl ? (
            <img src={previewUrl} alt="logo"
              style={{width:60,height:60,objectFit:"cover",borderRadius:8,
                border:"1px solid var(--border)"}} />
          ) : (
            <div style={{width:60,height:60,borderRadius:8,background:"var(--accent-bg)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🗃</div>
          )}
          <div>
            <label style={{cursor:"pointer"}}>
              <span className="btn btn-sm">🖼 {previewUrl ? "Trocar logo" : "Escolher logo"}</span>
              <input type="file" accept="image/*" style={{display:"none"}} onChange={handleLogoChange} />
            </label>
            {previewUrl && (
              <button className="btn btn-sm" style={{marginLeft:6}}
                onClick={()=>{setPreviewUrl(null);setLogoFile(null);}}>✕ Remover</button>
            )}
            <div style={{fontSize:11,color:"var(--text-muted)",marginTop:4}}>
              PNG, JPG ou GIF. Recomendado: 200×200px
            </div>
          </div>
        </div>
      </Field>

      <div className="modal-footer">
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving||!form.name.trim()}>
          {saving?"Salvando…":"Salvar"}
        </button>
      </div>
    </>
  );
}

export default function Projects() {
  const { refreshProjects, selectProject } = useProject();
  const { isAdmin, isManager }             = useAuth();
  const canManage = isAdmin || isManager;
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<ProjectWithStats | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [envModal, setEnvModal] = useState<ProjectWithStats | null>(null);
  const [envs,     setEnvs]     = useState<any[]>([]);
  const [envForm,  setEnvForm]  = useState({ name: "", color: "#6B7280" });
  const [envEdit,  setEnvEdit]  = useState<any | null>(null);
  const [envSaving,setEnvSaving]= useState(false);

  async function openEnvModal(p: ProjectWithStats) {
    setEnvModal(p);
    const data = await environmentsApi.list(p.id) as any;
    setEnvs(data?.data ?? data ?? []);
  }

  async function handleEnvSave() {
    if (!envForm.name.trim() || !envModal) return;
    setEnvSaving(true);
    try {
      if (envEdit) {
        await environmentsApi.update(envModal.id, envEdit.id, envForm);
      } else {
        await environmentsApi.create(envModal.id, { ...envForm, sort_order: envs.length });
      }
      const data = await environmentsApi.list(envModal.id) as any;
      setEnvs(data?.data ?? data ?? []);
      setEnvForm({ name: "", color: "#6B7280" });
      setEnvEdit(null);
    } finally { setEnvSaving(false); }
  }

  async function handleEnvDelete(envId: number) {
    if (!envModal) return;
    await environmentsApi.delete(envModal.id, envId);
    const data = await environmentsApi.list(envModal.id) as any;
    setEnvs(data?.data ?? data ?? []);
  }
  const { data: projectsRaw, loading, error, refetch } = useAsync(() => projectsApi.list());
  const projects = search
    ? (projectsRaw as ProjectWithStats[] || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : (projectsRaw as ProjectWithStats[] || []);

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  async function handleSave(form: ProjectFormData, logoFile: File | null) {
    setSaving(true); setErr(null);
    try {
      let project;
      if (modal.mode === "create") {
        project = await projectsApi.create(form);
      } else {
        project = await projectsApi.update(modal.item.id, form);
      }
      // Se tem logo, faz upload
      if (logoFile && project?.id) {
        await projectsApi.uploadLogo(project.id, logoFile);
      }
      setModal(null); refetch(); refreshProjects();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await projectsApi.delete(id); setConfirm(null); refetch(); refreshProjects(); }
    catch(e) { setErr(e.message); }
  }

  async function handleLogoUpload(projectId: number, file: File) {
    try { await projectsApi.uploadLogo(projectId, file); refetch(); refreshProjects(); }
    catch(e) { setErr(e.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projetos</h1>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Buscar projeto..."
          style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13,minWidth:220}} />
        {canManage && (
          <button className="btn btn-primary" onClick={() => setModal({ mode:"create" })}>
            + Novo projeto
          </button>
        )}
      </div>
      {err && <div style={{display:"flex",alignItems:"center",gap:8,background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
        <span style={{flex:1,fontSize:13,color:"#991B1B"}}>{err}</span>
        <button onClick={()=>setErr(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#991B1B",fontSize:16,fontWeight:700,lineHeight:1}}>✕</button>
      </div>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
        {!projects?.length
          ? <Empty icon="🗃" text="Nenhum projeto cadastrado." />
          : (projects as ProjectWithStats[]).map(p => (
            <div key={p.id} className="card" style={{ cursor:"pointer" }}
              onClick={() => selectProject(p.id)}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                {p.logo_url
                  ? <img src={p.logo_url} alt="logo"
                      style={{ width:48, height:48, objectFit:"cover", borderRadius:8,
                        border:"1px solid var(--border)" }} />
                  : <div style={{ width:48, height:48, borderRadius:8, background:"var(--accent-bg)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🗃</div>
                }
                <div>
                  <div style={{ fontWeight:600, fontSize:15 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>{p.description||"—"}</div>
                </div>
              </div>

              <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--text-muted)", marginBottom:12 }}>
                <span>🗂 {p.module_count} módulos</span>
                <span>🔁 {p.cycle_count} ciclos</span>
                <span>🐛 {p.bug_count} bugs</span>
              </div>

              <span className={`badge ${p.active ? "badge-passed":"badge-closed"}`}>
                {p.active ? "Ativo":"Inativo"}
              </span>

              {canManage && (
                <div className="actions" style={{ marginTop:12 }} onClick={e => e.stopPropagation()}>
                  <label style={{ cursor:"pointer" }} title="Trocar logo">
                    <span className="btn btn-sm">🖼 Logo</span>
                    <input type="file" style={{ display:"none" }} accept="image/*"
                      onChange={e => { if(e.target.files[0]) handleLogoUpload(p.id, e.target.files[0]); e.target.value=""; }} />
                  </label>
                  <button className="btn btn-sm" onClick={() => setModal({ mode:"edit", item:p })}>✏ Editar</button>
                  <button className="btn btn-sm" onClick={() => openEnvModal(p)}>🌍 Ambientes</button>
                  {isAdmin && (
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirm(p)}>🗑</button>
                  )}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {modal && (
        <Modal title={modal.mode==="create"?"Novo projeto":"Editar projeto"} onClose={() => setModal(null)}>
          <ProjectForm
            initial={modal.item||{}}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            saving={saving}
          />
        </Modal>
      )}
      {envModal && (
        <Modal title={`Ambientes — ${envModal.name}`} onClose={() => { setEnvModal(null); setEnvEdit(null); setEnvForm({ name: "", color: "#6B7280" }); }}>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
              <input value={envForm.name} onChange={e=>setEnvForm(f=>({...f,name:e.target.value}))}
                placeholder="Nome do ambiente (ex: QA, Sandbox...)"
                style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}} />
              <input type="color" value={envForm.color} onChange={e=>setEnvForm(f=>({...f,color:e.target.value}))}
                style={{width:36,height:34,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",padding:2}} />
              <button className="btn btn-primary" onClick={handleEnvSave} disabled={envSaving||!envForm.name.trim()}>
                {envEdit ? "Salvar" : "+ Adicionar"}
              </button>
              {envEdit && <button className="btn" onClick={()=>{setEnvEdit(null);setEnvForm({name:"",color:"#6B7280"})}}>Cancelar</button>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {envs.length === 0 && <p style={{color:"var(--text-muted)",fontSize:13}}>Nenhum ambiente cadastrado.</p>}
              {envs.map(e => (
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                  background:"var(--bg)",borderRadius:8,border:"1px solid var(--border)"}}>
                  <div style={{width:14,height:14,borderRadius:"50%",background:e.color,flexShrink:0}} />
                  <span style={{flex:1,fontSize:13,fontWeight:500}}>{e.name}</span>
                  <button className="btn btn-sm" onClick={()=>{setEnvEdit(e);setEnvForm({name:e.name,color:e.color})}}>✏</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>handleEnvDelete(e.id)}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {confirm && (
        <ConfirmModal message={`Excluir o projeto "${confirm.name}" e todos os seus dados?`}
          onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
