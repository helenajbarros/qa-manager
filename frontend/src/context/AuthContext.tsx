import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi } from "../services/resources.js";
import type { User } from "../types/index.js";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isEditor: boolean;
  isViewer: boolean;
  getAndClearRedirect: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("qa_token");
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(u => setUser(u))
      .catch(() => localStorage.removeItem("qa_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const result = await authApi.login(email, password);
    localStorage.setItem("qa_token", result.token);
    setUser(result.user);
    return result.user;
  }

  function getAndClearRedirect(): string | null {
    const redirect = sessionStorage.getItem("qa_redirect");
    if (redirect && redirect !== "/") {
      sessionStorage.removeItem("qa_redirect");
      return redirect;
    }
    return null;
  }

  function logout(): void {
    localStorage.removeItem("qa_token");
    setUser(null);
  }

  const isAdmin   = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isEditor  = ["admin", "manager", "editor"].includes(user?.role ?? "");
  const isViewer  = user?.role === "viewer";

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      isAdmin, isManager, isEditor, isViewer,
      getAndClearRedirect,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
