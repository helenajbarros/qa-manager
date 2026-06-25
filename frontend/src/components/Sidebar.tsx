import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth }    from "../context/AuthContext.js";
import { useProject } from "../context/ProjectContext.js";
import { notificationsApi } from "../services/resources.js";
import type { Notification } from "../types/index.js";
import type { UserRole } from "../types/index.js";

interface NavItem {
  section?: string;
  to?: string;
  icon?: string;
  label?: string;
}

const links: NavItem[] = [
  { section: "Visão Geral" },
  { to: "/",           icon: "📊", label: "Dashboard" },
  { section: "Cadastros" },
  { to: "/modules",    icon: "🧩", label: "Módulos" },
  { to: "/test-cases", icon: "📋", label: "Casos de Teste" },
  { section: "Execução" },
  { to: "/cycles",     icon: "🔁", label: "Ciclos de Teste" },
  { section: "Qualidade" },
  { to: "/bugs",       icon: "🐛", label: "Bugs" },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin:   "Admin",
  manager: "Gerente",
  editor:  "Colaborador / Tester",
  viewer:  "Visualizador",
};

const ROLE_COLOR: Record<UserRole, string> = {
  admin:   "#DC2626",
  manager: "#7C3AED",
  editor:  "#2563EB",
  viewer:  "#6B7280",
};

interface NotifResponse {
  items?: Notification[];
  unread?: number;
}

function NotificationBell() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [open,   setOpen]   = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await notificationsApi.list() as unknown as NotifResponse;
      setNotifs(res?.items ?? []);
      setUnread(res?.unread ?? 0);
    } catch (_) {}
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleClick = async (n: Notification) => {
    if (!n.read) await notificationsApi.markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
    load();
  };

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    load();
  };

  const fmtDate = (d?: string) => {
    if (!d) return "";
    const dt   = new Date(d);
    const now  = new Date();
    const diff = Math.floor((now.getTime() - dt.getTime()) / 60000);
    if (diff < 1)    return "agora";
    if (diff < 60)   return `${diff}min atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return dt.toLocaleDateString("pt-BR");
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "4px 8px", borderRadius: 6, position: "relative",
          fontSize: 18, color: "var(--text-muted)", transition: "color .2s",
        }}
        title="Notificações"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2, background: "#DC2626",
            color: "white", borderRadius: "50%", width: 16, height: 16,
            fontSize: 10, display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 700,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "fixed", top: 60, right: 16, width: 340, maxHeight: 420,
          background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,.15)", zIndex: 1000,
          overflowY: "auto", overflowX: "hidden",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid #E5E7EB",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Notificações</span>
            {unread > 0 && (
              <button onClick={handleMarkAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#2563EB" }}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {!notifs.length ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#6B7280", fontSize: 13 }}>
              Nenhuma notificação
            </div>
          ) : notifs.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                padding: "12px 16px", borderBottom: "1px solid #E5E7EB",
                cursor: "pointer", background: n.read ? "#ffffff" : "#EFF6FF",
                transition: "background .2s", display: "flex", gap: 10, alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {n.type === "assigned" ? "👤" : n.type === "mention" ? "💬" : "🔔"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "#111827", fontWeight: n.read ? 400 : 500 }}>
                  {n.message}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>
                  {fmtDate(n.created_at)}
                </div>
              </div>
              {!n.read && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, isAdmin, isManager } = useAuth();
  const { projects, currentProject, selectProject } = useProject();
  const canManage = isAdmin || isManager;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {currentProject?.logo_url ? (
            <img
              src={currentProject.logo_url}
              alt="logo"
              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 6, background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#fff", flexShrink: 0,
            }}>⚙</div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentProject?.name || "QA System"}
            </h1>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Gestão de Testes</span>
          </div>
        </div>

        {projects.length > 1 && (
          <select
            value={currentProject?.id ?? ""}
            onChange={(e) => selectProject(e.target.value)}
            style={{ width: "100%", padding: "5px 8px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <nav className="sidebar-nav">
        {links.map((item, i) =>
          item.section ? (
            <div key={i} className="nav-section">{item.section}</div>
          ) : (
            <NavLink key={item.to} to={item.to!} end={item.to === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </NavLink>
          )
        )}

        {canManage && (
          <>
            <div className="nav-section">Administração</div>
            <NavLink to="/projects" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon">🗃</span>Projetos
            </NavLink>
            <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon">👥</span>Usuários
            </NavLink>
            {isAdmin && (
              <NavLink to="/backup" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <span className="nav-icon">💾</span>Backup
              </NavLink>
            )}
          </>
        )}
      </nav>

      {user && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</div>
            <NotificationBell />
          </div>
          <div style={{ fontSize: 11, color: ROLE_COLOR[user.role] ?? "#6B7280", marginBottom: 8 }}>
            {ROLE_LABEL[user.role] ?? user.role}
          </div>
          <button
            onClick={logout}
            style={{ width: "100%", padding: "5px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            Sair
          </button>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 8, opacity: 0.5 }}>
            v1.6.0
          </div>
        </div>
      )}
    </aside>
  );
}
