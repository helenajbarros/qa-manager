import { createContext, useContext, useState, useEffect } from "react";
import { projectsApi } from "../services/resources.js";
import { useAuth }     from "./AuthContext.jsx";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { user }                                    = useAuth();
  const [projects,       setProjects]       = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading,        setLoading]        = useState(false);

  // Só carrega projetos quando o usuário estiver autenticado
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      return;
    }

    setLoading(true);
    projectsApi.list()
      .then(list => {
        setProjects(list);
        const saved = localStorage.getItem("qa_project_id");
        const found = saved ? list.find(p => String(p.id) === saved) : null;
        setCurrentProject(found || list[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  function selectProject(id) {
    const p = projects.find(x => x.id === Number(id));
    if (p) { setCurrentProject(p); localStorage.setItem("qa_project_id", p.id); }
  }

  function refreshProjects() {
    if (!user) return Promise.resolve();
    return projectsApi.list().then(list => {
      setProjects(list);
      if (currentProject) {
        const updated = list.find(p => p.id === currentProject.id);
        if (updated) setCurrentProject(updated);
      }
    });
  }

  return (
    <ProjectContext.Provider value={{ projects, currentProject, loading, selectProject, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() { return useContext(ProjectContext); }
