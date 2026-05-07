import { useState, useRef } from "react";
import { useAsync } from "../hooks/useAsync.js";
import { Loading, ErrorMsg } from "../components/UI.jsx";

function getBase() {
  return import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";
}
function getToken() { return localStorage.getItem("qa_token"); }

async function fetchInfo() {
  const res  = await fetch(`${getBase()}/backup/info`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function Backup() {
  const { data, loading, error, refetch } = useAsync(fetchInfo);
  const [downloading, setDownloading] = useState(false);
  const [restoring,   setRestoring]   = useState(false);
  const [restoreMsg,  setRestoreMsg]  = useState(null);
  const [restoreErr,  setRestoreErr]  = useState(null);
  const [lastBackup,  setLastBackup]  = useState(
    localStorage.getItem("qa_last_backup") || null
  );
  const fileInputRef = useRef();

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`${getBase()}/backup/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Erro ao baixar backup");

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const filename = res.headers.get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] || "qa_backup.db";

      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString("pt-BR");
      localStorage.setItem("qa_last_backup", now);
      setLastBackup(now);
    } catch(e) {
      alert("Erro ao baixar backup: " + e.message);
    } finally { setDownloading(false); }
  }

  async function handleRestore(file) {
    if (!file) return;
    if (!file.name.endsWith(".db")) {
      setRestoreErr("Apenas arquivos .db são aceitos.");
      return;
    }

    const confirmed = window.confirm(
      `⚠ ATENÇÃO!\n\nVocê está prestes a SUBSTITUIR todos os dados atuais pelo arquivo:\n"${file.name}"\n\nEssa ação não pode ser desfeita.\n\nTem certeza?`
    );
    if (!confirmed) return;

    setRestoring(true);
    setRestoreMsg(null);
    setRestoreErr(null);

    try {
      const fd = new FormData();
      fd.append("backup", file);

      const res  = await fetch(`${getBase()}/backup/restore`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body:    fd,
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error);

      setRestoreMsg(`✅ Banco restaurado com sucesso! (${json.data.size_kb} KB) — Recarregue a página para ver os dados atualizados.`);
      refetch();
    } catch(e) {
      setRestoreErr("Erro ao restaurar: " + e.message);
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  const counts = data?.counts || {};
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>💾 Backup & Restauração</h1>
      </div>

      {/* Aviso */}
      <div style={{ background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:8,
        padding:"14px 18px", marginBottom:20, fontSize:13, color:"#92400E" }}>
        <strong>⚠ Recomendação:</strong> Faça backup regularmente, especialmente antes de grandes mudanças.
        O arquivo <code>.db</code> contém <strong>todos os dados</strong> do sistema.
      </div>

      {/* Cards de status */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px,1fr))", gap:12, marginBottom:20 }}>
        <div className="card" style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>💾</div>
          <div style={{ fontSize:22, fontWeight:600 }}>{data?.size_kb || 0} KB</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>Tamanho do banco</div>
        </div>
        <div className="card" style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>📊</div>
          <div style={{ fontSize:22, fontWeight:600 }}>{total}</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>Total de registros</div>
        </div>
        <div className="card" style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:6 }}>🕐</div>
          <div style={{ fontSize:13, fontWeight:600 }}>{lastBackup || "Nunca"}</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>Último backup</div>
        </div>
      </div>

      {/* Ações */}
      <div className="grid-2" style={{ marginBottom:20 }}>

        {/* Baixar backup */}
        <div className="card">
          <div className="card-title">⬇ Fazer Backup</div>
          <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6 }}>
            Baixa um arquivo <code>.db</code> com todos os dados do sistema.
            Guarde em local seguro (Google Drive, HD externo, etc).
          </p>
          <button className="btn btn-primary" onClick={handleDownload}
            disabled={downloading} style={{ width:"100%", justifyContent:"center" }}>
            {downloading ? "⏳ Preparando…" : "⬇ Baixar Backup (.db)"}
          </button>
          {lastBackup && (
            <p style={{ fontSize:11, color:"var(--success)", marginTop:8, textAlign:"center" }}>
              ✅ Último backup: {lastBackup}
            </p>
          )}
        </div>

        {/* Restaurar backup */}
        <div className="card">
          <div className="card-title">⬆ Restaurar Backup</div>
          <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6 }}>
            Selecione um arquivo <code>.db</code> de backup anterior para restaurar.
            <strong style={{ color:"var(--danger)" }}> Os dados atuais serão substituídos.</strong>
          </p>

          {restoreMsg && (
            <div style={{ background:"var(--success-bg)", color:"var(--success)",
              border:"1px solid #86EFAC", borderRadius:6, padding:"10px 14px",
              fontSize:13, marginBottom:12 }}>
              {restoreMsg}
            </div>
          )}
          {restoreErr && (
            <div style={{ background:"var(--danger-bg)", color:"var(--danger)",
              border:"1px solid #FECACA", borderRadius:6, padding:"10px 14px",
              fontSize:13, marginBottom:12 }}>
              {restoreErr}
            </div>
          )}

          <label style={{ display:"block", width:"100%" }}>
            <div className={`btn ${restoring ? "" : "btn-danger"}`}
              style={{ width:"100%", justifyContent:"center", opacity: restoring ? .6 : 1 }}>
              {restoring ? "⏳ Restaurando…" : "⬆ Selecionar arquivo .db"}
            </div>
            <input ref={fileInputRef} type="file" accept=".db"
              style={{ display:"none" }}
              disabled={restoring}
              onChange={e => { if(e.target.files[0]) handleRestore(e.target.files[0]); }} />
          </label>
        </div>
      </div>

      {/* Contagem por tabela */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-title">Registros por tabela</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tabela</th><th>Registros</th></tr></thead>
            <tbody>
              {[
                { key:"projects",        label:"🗃 Projetos" },
                { key:"users",           label:"👥 Usuários" },
                { key:"modules",         label:"🗂 Módulos" },
                { key:"test_cases",      label:"📋 Casos de teste" },
                { key:"test_cycles",     label:"🔁 Ciclos de teste" },
                { key:"test_executions", label:"▶ Execuções" },
                { key:"bugs",            label:"🐛 Bugs" },
                { key:"evidence_files",  label:"📎 Arquivos de evidência" },
              ].map(({ key, label }) => (
                <tr key={key}>
                  <td style={{ fontWeight:500 }}>{label}</td>
                  <td><span className="badge badge-active">{counts[key] || 0}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instruções */}
      <div className="card">
        <div className="card-title">📖 Como funciona</div>
        <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.9 }}>
          <p><strong style={{ color:"var(--text)" }}>⬇ Fazer backup:</strong><br />
          Clique em "Baixar Backup" — você receberá um arquivo <code>qa_backup_DATA.db</code>.
          Guarde em local seguro. Faça isso semanalmente ou antes de grandes mudanças.</p>

          <p style={{ marginTop:12 }}><strong style={{ color:"var(--text)" }}>⬆ Restaurar backup:</strong><br />
          Clique em "Selecionar arquivo .db", escolha o arquivo de backup e confirme.
          O sistema vai substituir o banco atual pelo backup e reinicializar automaticamente.
          Após restaurar, <strong>recarregue a página</strong> para ver os dados atualizados.</p>

          <p style={{ marginTop:12 }}><strong style={{ color:"var(--text)" }}>🔒 Segurança automática:</strong><br />
          Antes de qualquer restauração, o sistema salva automaticamente um backup do banco atual
          no servidor como proteção — assim você nunca perde os dados sem querer.</p>

          <p style={{ marginTop:12 }}><strong style={{ color:"var(--danger)" }}>⚠ Importante:</strong><br />
          Os arquivos de evidência (imagens, PDFs) ficam na pasta <code>uploads/</code>
          e <strong>não estão incluídos</strong> no backup do banco.
          Para backup completo em produção, faça também o backup do disco no painel do Render.</p>
        </div>
      </div>
    </div>
  );
}
