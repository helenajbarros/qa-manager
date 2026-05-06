import { useState } from "react";

export function FileUpload({ files = [], onUpload, onDelete, accept = "image/*,.pdf,.doc,.docx,.txt,.zip" }) {
  const [uploading, setUploading] = useState(false);

  const isImage = name => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
  const fmtSize = b => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)}MB` : `${(b/1024).toFixed(0)}KB`;

  async function handleFiles(fileList) {
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await onUpload(file);
      }
    } finally { setUploading(false); }
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <label
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="upload-zone"
        style={{ display: "block" }}
      >
        <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {uploading ? "Enviando…" : "Arraste arquivos ou clique para selecionar"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>
          Imagens, PDF, DOC, ZIP — máx 10MB por arquivo
        </div>
        <input type="file" multiple style={{ display: "none" }} accept={accept}
          onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ""; }}
          disabled={uploading} />
      </label>

      {files.length > 0 && (
        <div className="file-grid" style={{ marginTop: 10 }}>
          {files.map(f => (
            <div key={f.id} className="file-thumb">
              {isImage(f.originalname) ? (
                <a href={`/uploads/${f.filename}`} target="_blank" rel="noreferrer">
                  <img src={`/uploads/${f.filename}`} alt={f.originalname}
                    style={{ width: 72, height: 72, objectFit: "cover", display: "block" }} />
                </a>
              ) : (
                <a href={`/uploads/${f.filename}`} target="_blank" rel="noreferrer"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "10px 8px", width: 80, textDecoration: "none" }}>
                  <span style={{ fontSize: 24 }}>
                    {f.originalname.endsWith(".pdf") ? "📄"
                     : f.originalname.endsWith(".zip") ? "🗜"
                     : "📎"}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4,
                    textAlign: "center", wordBreak: "break-all", maxWidth: 70,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.originalname}
                  </span>
                </a>
              )}
              <div style={{ fontSize: 9, color: "var(--text-light)", textAlign: "center",
                padding: "2px 4px" }}>
                {fmtSize(f.size)}
              </div>
              {onDelete && (
                <button onClick={() => onDelete(f.id)}
                  style={{ position: "absolute", top: 2, right: 2,
                    background: "rgba(220,38,38,.85)", color: "#fff",
                    border: "none", borderRadius: 3, cursor: "pointer",
                    fontSize: 9, padding: "1px 4px", lineHeight: 1.5 }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
