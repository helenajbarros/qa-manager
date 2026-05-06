import { NavLink } from "react-router-dom";
import { useAuth }    from "../context/AuthContext.jsx";
import { useProject } from "../context/ProjectContext.jsx";

const links = [
  { section: "Visão Geral" },
  { to: "/",           icon: "📊", label: "Dashboard" },
  { section: "Cadastros" },
  { to: "/modules",    icon: "🗂",  label: "Módulos" },
  { to: "/test-cases", icon: "📋", label: "Casos de Teste" },
  { section: "Execução" },
  { to: "/cycles",     icon: "🔁", label: "Ciclos de Teste" },
  { section: "Qualidade" },
  { to: "/bugs",       icon: "🐛", label: "Bugs" },
];

const ROLE_LABEL = { admin:"Admin", editor:"Editor", viewer:"Visualizador" };
const ROLE_COLOR = { admin:"#DC2626", editor:"#2563EB", viewer:"#6B7280" };

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const { projects, currentProject, selectProject } = useProject();

  return (
    <aside className="sidebar">
      {/* Logo + seletor de projeto */}
      <div className="sidebar-logo">
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          {currentProject?.logo_url
            ? <img src={`/uploads/${currentProject.logo_url}`} alt="logo"
                style={{ width:36, height:36, objectFit:"cover", borderRadius:6, border:"1px solid var(--border)" }} />
            : <div style={{ width:36, height:36, borderRadius:6, background:"var(--accent)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18, color:"#fff", flexShrink:0 }}>⚙</div>
          }
          <div style={{ minWidth:0 }}>
            <h1 style={{ fontSize:14, fontWeight:600, color:"var(--accent)",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {currentProject?.name || "QA System"}
            </h1>
            <span style={{ fontSize:11, color:"var(--text-muted)" }}>Gestão de Testes</span>
          </div>
        </div>

        {projects.length > 1 && (
          <select value={currentProject?.id || ""} onChange={e => selectProject(e.target.value)}
            style={{ width:"100%", padding:"5px 8px", fontSize:12, borderRadius:6,
              border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)" }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <nav className="sidebar-nav">
        {links.map((item, i) =>
          item.section ? (
            <div key={i} className="nav-section">{item.section}</div>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </NavLink>
          )
        )}
        {isAdmin && (
          <>
            <div className="nav-section">Administração</div>
            <NavLink to="/projects"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon">🗃</span>Projetos
            </NavLink>
            <NavLink to="/users"
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-icon">👥</span>Usuários
            </NavLink>
          </>
        )}
      </nav>

      {user && (
        <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)" }}>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{user.name}</div>
          <div style={{ fontSize:11, color:ROLE_COLOR[user.role], marginBottom:8 }}>
            {ROLE_LABEL[user.role]}
          </div>
          <button onClick={logout} style={{ width:"100%", padding:"5px", fontSize:12,
            border:"1px solid var(--border)", borderRadius:6,
            background:"none", cursor:"pointer", color:"var(--text-muted)" }}>
            Sair
          </button>
        </div>
      )}
    </aside>
  );
}
