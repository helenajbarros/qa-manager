import { useState } from "react";
import { useAsync } from "../hooks/useAsync.js";
import { Loading, ErrorMsg } from "../components/UI.jsx";

function getBase() {
  return import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";
}

function getToken() {
  return localStorage.getItem("qa_token");
}

async function fetchInfo() {
  const res  = await fetch(`${getBase()}/backup/info`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  return json.data ?? json;
}

export default function Backup() {
  const { data, loading, error, refetch } = useAsync(fetchInfo);
  const [downloading, setDownloading] = useState(false);
  const [lastBackup,  setLastBackup]  = useState(
    localStorage.getItem("qa_last_backup") || null
  );

  async function handleDownload() {
    setDownloading(true);
    try {
      const token = getToken();
      const res   = await fetch(`${getBase()}/backup/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erro ao baixar backup");

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const filename = res.headers.get("Content-Disposition")
        ?.match(/filename="(.+)"/)?.[1] || "qa_backup.db";

      const a  = document.createElement("a");
      a.href   = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString("pt-BR");
      localStorage.setItem("qa_last_backup", now);
      setLastBackup(now);
    } catch(e) {
      alert("Erro ao baixar backup: " + e.message);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <Loading />;
  if (error)   return <ErrorMsg msg={error} />;

  const counts = data?.counts || {};
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Backup do Banco de Dados</h1>
        <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? "⏳ Preparando…" : "⬇ Baixar Backup (.db)"}
        </button>
      </div>

      {/* Aviso */}
      <div style={{
        background: "#FEF3C7", border: "1px solid #FDE68A",
        borderRadius: 8, padding: "14px 18px", marginBottom: 20,
        fontSize: 13, color: "#92400E",
      }}>
        <strong>⚠ Recomendação:</strong> Faça backup regularmente, especialmente antes de grandes mudanças.
        O arquivo <code>.db</code> contém todos os dados do sistema e pode ser restaurado futuramente.
      </div>

      {/* Info do banco */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💾</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{data?.size_kb || 0} KB</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Tamanho do banco</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{total}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Total de registros</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🕐</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{lastBackup || "Nunca"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Último backup</div>
        </div>
      </div>

      {/* Contagem por tabela */}
      <div className="card">
        <div className="card-title">Registros por tabela</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Tabela</th><th>Registros</th></tr>
            </thead>
            <tbody>
              {[
                { key: "projects",        label: "🗃 Projetos" },
                { key: "users",           label: "👥 Usuários" },
                { key: "modules",         label: "🗂 Módulos" },
                { key: "test_cases",      label: "📋 Casos de teste" },
                { key: "test_cycles",     label: "🔁 Ciclos de teste" },
                { key: "test_executions", label: "▶ Execuções" },
                { key: "bugs",            label: "🐛 Bugs" },
                { key: "evidence_files",  label: "📎 Arquivos de evidência" },
              ].map(({ key, label }) => (
                <tr key={key}>
                  <td style={{ fontWeight: 500 }}>{label}</td>
                  <td>
                    <span className="badge badge-active">{counts[key] || 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instruções */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Como usar o backup</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.8 }}>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "var(--text)" }}>📥 Para fazer backup:</strong><br />
            Clique em "Baixar Backup" — você receberá um arquivo <code>.db</code> com todos os dados.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "var(--text)" }}>🔄 Para restaurar:</strong><br />
            Substitua o arquivo <code>data/qa_system.db</code> no servidor pelo arquivo de backup
            e reinicie o servidor.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: "var(--text)" }}>📅 Frequência recomendada:</strong><br />
            Faça backup semanal ou sempre antes de grandes mudanças no sistema.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>⚠ Importante:</strong><br />
            Os arquivos de evidência (imagens, PDFs) ficam na pasta <code>uploads/</code>
            e não estão incluídos no backup do banco. Faça backup dessa pasta separadamente
            pelo painel do Render em <strong>Disks</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
