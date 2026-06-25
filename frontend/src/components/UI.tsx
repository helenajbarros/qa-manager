import { ReactNode, CSSProperties } from "react";

// ── Types ─────────────────────────────────────────────────────
type BadgeValue = string;
type BadgeMap   = Record<string, string>;

interface BadgeProps   { value: BadgeValue; map?: BadgeMap; }
interface EmptyProps   { icon?: string; text?: string; }
interface ModalProps   { title: string; onClose: () => void; children: ReactNode; }
interface ConfirmProps { message: string; onConfirm: () => void; onCancel: () => void; }
interface FieldProps   { label: string; children: ReactNode; }

interface SelectOption { value: string | number; label: string; }
interface SelectProps  {
  value: string | number;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

interface BadgeOnlyProps { v: string; }

// ── Constantes ────────────────────────────────────────────────
const STATUS_EXEC: BadgeMap  = { passed: "Passou", failed: "Falhou", blocked: "Bloqueado", not_executed: "Não executado" };
const STATUS_BUG:  BadgeMap  = { open: "Aberto", in_progress: "Em andamento", fixed: "Corrigido", closed: "Fechado" };
const SEVERITY:    BadgeMap  = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
const PRIORITY:    BadgeMap  = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
const STATUS_CYCLE: BadgeMap = { active: "Ativo", completed: "Concluído", archived: "Arquivado" };

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ value, map }: BadgeProps) {
  const label = map?.[value] ?? value;
  return <span className={`badge badge-${value}`}>{label}</span>;
}

export const ExecBadge  = ({ v }: BadgeOnlyProps) => <Badge value={v} map={STATUS_EXEC} />;
export const BugStatus  = ({ v }: BadgeOnlyProps) => <Badge value={v} map={STATUS_BUG} />;
export const Severity   = ({ v }: BadgeOnlyProps) => <Badge value={v} map={SEVERITY} />;
export const Priority   = ({ v }: BadgeOnlyProps) => <Badge value={v} map={PRIORITY} />;
export const CycleBadge = ({ v }: BadgeOnlyProps) => <Badge value={v} map={STATUS_CYCLE} />;

// ── Loading / Error / Empty ───────────────────────────────────
export function Loading() {
  return <div className="loading">Carregando...</div>;
}

export function ErrorMsg({ msg }: { msg: string }) {
  return <div className="error-msg">⚠ {msg}</div>;
}

export function Empty({ icon = "📋", text = "Nenhum registro encontrado." }: EmptyProps) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ── Confirm delete ────────────────────────────────────────────
export function ConfirmModal({ message, onConfirm, onCancel }: ConfirmProps) {
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

// ── Form helpers ──────────────────────────────────────────────
export function Field({ label, children }: FieldProps) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }: SelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
