import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

export default function Login() {
  const { login, getAndClearRedirect } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      const redirect = getAndClearRedirect();
      navigate(redirect ?? "/", { replace: true });
    } catch (err) {
      setError((err as Error).message || "Credenciais inválidas");
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "40px 36px", width: "100%", maxWidth: 380,
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚙</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>QA System</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Gestão de Testes de Qualidade
          </p>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-bg)", color: "var(--danger)",
            border: "1px solid #FECACA", borderRadius: 6,
            padding: "8px 12px", fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoFocus required />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "9px", marginTop: 4 }}
            disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "var(--text-light)", textAlign: "center", marginTop: 20 }}>
          No momento não é possível criar novas contas.
        </p>
      </div>
    </div>
  );
}
