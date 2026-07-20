import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { projectsApi } from "../services/resources.js";
import { useAuth }     from "./AuthContext.js";
import type { Project } from "../types/index.js";

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  selectProject: (id: number | string) => void;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading }                 = useAuth();
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    // Aguarda o auth terminar de carregar antes de verificar o user
    if (authLoading) return;
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    projectsApi.list()
      .then(list => {
        setProjects(list);

        const saved          = localStorage.getItem("qa_project_id");
        const savedProject   = saved ? list.find(p => String(p.id) === saved) : null;
        const defaultProject = user.default_project_id
          ? list.find(p => String(p.id) === String(user.default_project_id))
          : null;

        if (!list.length) {
          localStorage.removeItem("qa_project_id");
          setCurrentProject(null);
        } else {
          // Se o projeto salvo não está na lista do usuário, limpa e usa o primeiro
          if (saved && !savedProject) {
            localStorage.removeItem("qa_project_id");
          }
          setCurrentProject(savedProject || defaultProject || list[0] || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  function selectProject(id: number | string): void {
    const p = projects.find(x => x.id === Number(id));
    if (p) {
      setCurrentProject(p);
      localStorage.setItem("qa_project_id", String(p.id));
    }
  }

  async function refreshProjects(): Promise<void> {
    if (!user) return;
    const list = await projectsApi.list();
    setProjects(list);
    if (currentProject) {
      const updated = list.find(p => p.id === currentProject.id);
      if (updated) setCurrentProject(updated);
    }
  }

  return (
    <ProjectContext.Provider value={{ projects, currentProject, loading, selectProject, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
