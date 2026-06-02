import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth }    from "./context/AuthContext.jsx";
import Sidebar    from "./components/Sidebar.jsx";
import Login      from "./pages/Login.jsx";
import Dashboard  from "./pages/Dashboard.jsx";
import Modules    from "./pages/Modules.jsx";
import TestCases  from "./pages/TestCases.jsx";
import Cycles     from "./pages/Cycles.jsx";
import Bugs       from "./pages/Bugs.jsx";
import BugDetail  from "./pages/BugDetail.jsx";
import Users      from "./pages/Users.jsx";
import Projects   from "./pages/Projects.jsx";
import Backup     from "./pages/Backup.jsx";

function Guard({ children, adminOnly }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="loading">Carregando…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{height:"100vh"}}>Carregando…</div>;
  if (!user)   return <Routes><Route path="*" element={<Login />} /></Routes>;

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/"             element={<Guard><Dashboard /></Guard>} />
          <Route path="/modules"      element={<Guard><Modules /></Guard>} />
          <Route path="/test-cases"   element={<Guard><TestCases /></Guard>} />
          <Route path="/cycles"       element={<Guard><Cycles /></Guard>} />
          <Route path="/bugs"         element={<Guard><Bugs /></Guard>} />
          <Route path="/bugs/:id"     element={<Guard><BugDetail /></Guard>} />
          <Route path="/projects"     element={<Guard adminOnly><Projects /></Guard>} />
          <Route path="/users"        element={<Guard adminOnly><Users /></Guard>} />
          <Route path="/backup"       element={<Guard adminOnly><Backup /></Guard>} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
