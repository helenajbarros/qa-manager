import { createContext, useContext, useState, useEffect } from "react";
import { projectsApi } from "../services/resources.js";
import { useAuth }     from "./AuthContext.jsx";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const { user }                                    = useAuth();
  const [projects,       setProjects]       = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading,        setLoading]        = useState(false);

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

        // Prioridade de seleção:
        // 1. Projeto salvo no localStorage (última seleção manual)
        // 2. Projeto padrão do usuário (default_project_id)
        // 3. Primeiro projeto da lista
        const saved          = localStorage.getItem("qa_project_id");
        const savedProject   = saved ? list.find(p => String(p.id) === saved) : null;
        const defaultProject = user.default_project_id
          ? list.find(p => String(p.id) === String(user.default_project_id))
          : null;

        setCurrentProject(savedProject || defaultProject || list[0] || null);
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
