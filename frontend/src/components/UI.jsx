// ── Badge ────────────────────────────────────────────────────
export function Badge({ value, map }) {
  const label = map?.[value] ?? value;
  return <span className={`badge badge-${value}`}>{label}</span>;
}

const STATUS_EXEC = { passed: "Passou", failed: "Falhou", blocked: "Bloqueado", not_executed: "Não executado" };
const STATUS_BUG  = { open: "Aberto", in_progress: "Em andamento", fixed: "Corrigido", closed: "Fechado" };
const SEVERITY    = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
const PRIORITY    = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
const STATUS_CYCLE = { active: "Ativo", completed: "Concluído", archived: "Arquivado" };

export const ExecBadge  = ({ v }) => <Badge value={v} map={STATUS_EXEC} />;
export const BugStatus  = ({ v }) => <Badge value={v} map={STATUS_BUG} />;
export const Severity   = ({ v }) => <Badge value={v} map={SEVERITY} />;
export const Priority   = ({ v }) => <Badge value={v} map={PRIORITY} />;
export const CycleBadge = ({ v }) => <Badge value={v} map={STATUS_CYCLE} />;

// ── Loading / Error / Empty ──────────────────────────────────
export function Loading() {
  return <div className="loading">Carregando...</div>;
}

export function ErrorMsg({ msg }) {
  return <div className="error-msg">⚠ {msg}</div>;
}

export function Empty({ icon = "📋", text = "Nenhum registro encontrado." }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── Confirm delete ───────────────────────────────────────────
export function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <h3>Confirmar exclusão</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "12px 0 20px" }}>
          {message}
        </p>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

// ── Form helpers ─────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
