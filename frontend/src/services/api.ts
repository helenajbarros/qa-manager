const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

function getToken(): string | null {
  return localStorage.getItem("qa_token");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Falha de rede, CORS ou servidor fora do ar (ex.: instância gratuita acordando)
    throw new Error("Não foi possível conectar ao servidor. Se ele estava inativo, aguarde cerca de 1 minuto e tente novamente.");
  }

  if (res.status === 204) return null as T;

  // A resposta pode não ser JSON (ex.: página de erro 404/502 do proxy)
  let json: any = null;
  try { json = await res.json(); } catch { /* corpo vazio ou não-JSON */ }

  if (!res.ok) {
    if (json?.error) throw new Error(json.error);
    if (res.status === 404) throw new Error("Recurso não encontrado no servidor (404).");
    if (res.status >= 500) throw new Error("O servidor está indisponível no momento. Tente novamente em instantes.");
    throw new Error("Erro na requisição");
  }
  return (json?.data ?? json) as T;
}

export const api = {
  get:    <T>(path: string)              => request<T>("GET",    path),
  post:   <T>(path: string, body: unknown) => request<T>("POST",   path, body),
  put:    <T>(path: string, body: unknown) => request<T>("PUT",    path, body),
  delete: <T>(path: string)              => request<T>("DELETE", path),
};

export function getApiBase(): string {
  return import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : "/api";
}
