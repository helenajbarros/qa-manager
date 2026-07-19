import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth }    from "./context/AuthContext.js";
import { useProject } from "./context/ProjectContext.js";
import Sidebar    from "./components/Sidebar.js";
import Login      from "./pages/Login.js";
import Dashboard  from "./pages/Dashboard.js";
import Modules    from "./pages/Modules.js";
import TestCases  from "./pages/TestCases.js";
import Cycles     from "./pages/Cycles.js";
import Bugs       from "./pages/Bugs.js";
import BugDetail  from "./pages/BugDetail.js";
import TestPlan   from "./pages/TestPlan.js";
import ShareBug   from "./pages/ShareBug.js";
import Users      from "./pages/Users.js";
import Projects   from "./pages/Projects.js";
import Backup     from "./pages/Backup.js";

interface GuardProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  managerOk?: boolean;
}

function Guard({ children, adminOnly = false, managerOk = false }: GuardProps) {
  const { user, loading, isAdmin, isManager } = useAuth();
  const { projects, loading: projectsLoading } = useProject();

  if (loading || projectsLoading) return <div className="loading">Carregando…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (managerOk && !isAdmin && !isManager) return <Navigate to="/" replace />;

  // Admin vê tudo. Outros perfis precisam de pelo menos 1 projeto vinculado.
  if (!isAdmin && !projects?.length) {
    return (
      <div className="page" style={{display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",minHeight:"60vh",gap:16,textAlign:"center"}}>
        <div style={{fontSize:48}}>🔒</div>
        <h2 style={{fontSize:18,fontWeight:700}}>Sem acesso a projetos</h2>
        <p style={{fontSize:14,color:"var(--text-muted)",maxWidth:400}}>
          Você ainda não foi vinculado a nenhum projeto.<br/>
          Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function RedirectHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const redirect = sessionStorage.getItem("qa_redirect");
    if (redirect && redirect !== "/" && !redirect.startsWith("/share/")) {
      sessionStorage.removeItem("qa_redirect");
      navigate(redirect, { replace: true });
    } else if (redirect) {
      sessionStorage.removeItem("qa_redirect");
    }
  }, []);
  return null;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading" style={{height:"100vh"}}>Carregando…</div>;

  const savedRedirect = sessionStorage.getItem("qa_redirect") || "";
  const currentPath = window.location.pathname.replace("/qa-manager", "") || "/";
  const isShareRoute = currentPath.startsWith("/share/") || savedRedirect.startsWith("/share/");

  if (isShareRoute) {
    if (savedRedirect.startsWith("/share/")) {
      sessionStorage.removeItem("qa_redirect");
      window.history.replaceState(null, "", "/qa-manager" + savedRedirect);
    }
    return (
      <Routes>
        <Route path="/share/:token" element={<ShareBug />} />
        <Route path="*" element={<ShareBug />} />
      </Routes>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/share/:token" element={<ShareBug />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <RedirectHandler />
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/"             element={<Guard><Dashboard /></Guard>} />
          <Route path="/modules"      element={<Guard><Modules /></Guard>} />
          <Route path="/test-cases"   element={<Guard><TestCases /></Guard>} />
          <Route path="/cycles"       element={<Guard><Cycles /></Guard>} />
          <Route path="/bugs"         element={<Guard><Bugs /></Guard>} />
          <Route path="/bugs/:id"     element={<Guard><BugDetail /></Guard>} />
          <Route path="/cycles/:id/test-plan" element={<Guard><TestPlan /></Guard>} />
          <Route path="/projects"     element={<Guard managerOk><Projects /></Guard>} />
          <Route path="/users"        element={<Guard managerOk><Users /></Guard>} />
          <Route path="/backup"       element={<Guard adminOnly><Backup /></Guard>} />
          <Route path="/share/:token" element={<ShareBug />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
