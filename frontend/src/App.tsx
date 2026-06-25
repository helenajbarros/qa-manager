import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth }    from "./context/AuthContext.js";
import Sidebar    from "./components/Sidebar.js";
import Login      from "./pages/Login.js";
import Dashboard  from "./pages/Dashboard.js";
import Modules    from "./pages/Modules.js";
import TestCases  from "./pages/TestCases.js";
import Cycles     from "./pages/Cycles.js";
import Bugs       from "./pages/Bugs.js";
import BugDetail  from "./pages/BugDetail.js";
import ShareBug   from "./pages/ShareBug.js";
import Users      from "./pages/Users.js";
import Projects   from "./pages/Projects.js";
import Backup     from "./pages/Backup.js";

function Guard({ children, adminOnly, managerOk }) {
  const { user, loading, isAdmin, isManager } = useAuth();
  if (loading) return <div className="loading">Carregando…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (managerOk && !isAdmin && !isManager) return <Navigate to="/" replace />;
  return children;
}

// Redireciona após login para rota salva (exceto rotas públicas)
function RedirectHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    const redirect = sessionStorage.getItem("qa_redirect");
    if (redirect && redirect !== "/" && !redirect.startsWith("/share/")) {
      sessionStorage.removeItem("qa_redirect");
      navigate(redirect, { replace: true });
    } else if (redirect) {
      // Limpa qualquer redirect que não deva ser usado aqui
      sessionStorage.removeItem("qa_redirect");
    }
  }, []);
  return null;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading" style={{height:"100vh"}}>Carregando…</div>;

  // Verifica se é uma rota pública /share/
  const savedRedirect = sessionStorage.getItem("qa_redirect") || "";
  const currentPath = window.location.pathname.replace("/qa-manager", "") || "/";
  const isShareRoute = currentPath.startsWith("/share/") || savedRedirect.startsWith("/share/");

  if (isShareRoute) {
    // Limpa o redirect e monta só a rota pública
    if (savedRedirect.startsWith("/share/")) {
      sessionStorage.removeItem("qa_redirect");
      // Força navegar para a rota do share
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
