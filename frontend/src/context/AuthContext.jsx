import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../services/resources.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("qa_token");
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(u => setUser(u))
      .catch(() => localStorage.removeItem("qa_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const result = await authApi.login(email, password);
    localStorage.setItem("qa_token", result.token);
    setUser(result.user);
    return result.user;
  }

  // Após login, redireciona para a rota salva pelo 404.html
  function getAndClearRedirect() {
    const redirect = sessionStorage.getItem("qa_redirect");
    if (redirect && redirect !== "/") {
      sessionStorage.removeItem("qa_redirect");
      return redirect;
    }
    return null;
  }

  function logout() {
    localStorage.removeItem("qa_token");
    setUser(null);
  }

  const isAdmin   = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isEditor  = ["admin","manager","editor"].includes(user?.role);
  const isViewer  = user?.role === "viewer";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isManager, isEditor, isViewer, getAndClearRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

