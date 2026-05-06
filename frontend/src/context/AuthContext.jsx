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

  function logout() {
    localStorage.removeItem("qa_token");
    setUser(null);
  }

  const isAdmin  = user?.role === "admin";
  const isEditor = ["admin","editor"].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isEditor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
