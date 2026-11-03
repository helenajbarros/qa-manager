import { useEffect, useState } from "react";
import { clickupApi, type ClickupStatus, type ClickupList } from "../services/resources.js";

const STATUS_PT: Record<string, string> = { open: "aberto", in_progress: "em andamento", fixed: "corrigido", closed: "fechado" };
export const inClickup = (b: { tracker_url?: string | null }) => /clickup\.com\/t\//i.test(String(b.tracker_url || ""));
const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 };
const inp: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 };

/** Barra do ClickUp na lista de Bugs: enviar os marcados como task, sincronizar status e (admin) configurar. */
export default function ClickupPanel({ bugs, selected, setSelected, projectId, isAdmin, canSend, onChanged }: {
  bugs: { id: number; tracker_url?: string | null }[]; selected: Set<number>; setSelected: (s: Set<number>) => void;
  projectId?: number; isAdmin: boolean; canSend: boolean; onChanged: () => void;
}) {
  const [st, setSt] = useState<ClickupStatus | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [token, setToken] = useState("");
  const [lists, setLists] = useState<ClickupList[]>([]);
  const [pick, setPick] = useState("");
  const load = () => clickupApi.status().then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); }, []);
  if (!st) return null;
  const configured = st.hasMyToken && !!st.listName;
  const pending = bugs.filter((b) => !inClickup(b));
  const count = [...selected].filter((id) => pending.some((b) => b.id === id)).length;

  const run = async (name: string, fn: () => Promise<string | void>) => {
    setBusy(name); setMsg(null);
    try { const t = await fn(); if (t) setMsg({ ok: true, text: t }); } catch (e: any) { setMsg({ ok: false, text: e?.message || "Erro" }); } finally { setBusy(""); }
  };
  const send = () => {
    const ids = [...selected].filter((id) => pending.some((b) => b.id === id));
    if (!ids.length) return;
    if (!window.confirm(`Enviar ${ids.length} bug(s) como task para a lista “${st.listPath || st.listName}” do ClickUp?\n\nSó vai o que você marcou. Bugs que já estão no ClickUp são pulados.`)) return;
    run("send", async () => {
      const r = await clickupApi.send(ids);
      setSelected(new Set()); onChanged();
      return `${r.sent.length} task(s) criada(s) no ClickUp${r.skipped.length ? `, ${r.skipped.length} já estavam lá` : ""}${r.failed.length ? `. Falhou: ${r.failed.slice(0, 2).map((f) => f.error).join("; ")}` : "."}`;
    });
  };
  const sync = () => run("sync", async () => {
    const r = await clickupApi.sync(projectId);
    if (r.changed.length) onChanged();
    return `${r.checked} bug(s) conferido(s) no ClickUp; ${r.changed.length ? `atualizados: ${r.changed.map((c) => `#${c.id} → ${STATUS_PT[c.to] || c.to}`).join(", ")}` : "nenhuma mudança"}.${r.unmapped.length ? ` Status que não sei traduzir: ${r.unmapped.join(", ")}.` : ""}${r.failed ? ` ${r.failed} falharam.` : ""}`;
  });

  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>ClickUp</strong>
        {!configured ? (
          <span style={{ color: "var(--warning)" }}>{!st.hasMyToken ? "Cole o seu token pessoal do ClickUp em ⚙ (a task sai no seu nome)." : "O admin ainda não escolheu a lista do ClickUp."}</span>
        ) : (
          <>
            <span>Lista: <strong>{st.listName}</strong></span>
            <span style={{ color: "var(--text-muted)" }}>{count} marcado(s)</span>
            {canSend && <button className="btn btn-sm" onClick={() => setSelected(new Set(pending.map((b) => b.id)))}>marcar todos desta tela ({pending.length})</button>}
            {count > 0 && <button className="btn btn-sm" onClick={() => setSelected(new Set())}>limpar</button>}
            {canSend && <button className="btn btn-primary btn-sm" disabled={!!busy || !count} onClick={send}>{busy === "send" ? "Enviando…" : "Enviar ao ClickUp como task"}</button>}
            {canSend && <button className="btn btn-sm" disabled={!!busy} onClick={sync} title="Confere no ClickUp se o status das tasks mudou e atualiza aqui">{busy === "sync" ? "Sincronizando…" : "↻ Sincronizar status"}</button>}
            <span style={{ color: st.mirrorOn ? "var(--success)" : "var(--text-muted)", fontSize: 12 }}>{st.mirrorOn ? "● espelhamento automático ligado" : "espelhamento automático desligado"}</span>
          </>
        )}
        {canSend && <button className="btn btn-sm" onClick={() => setOpen(!open)} title="Mostrar/ocultar o token e as configurações">{open ? "▾" : "▸"} ⚙ Meu token</button>}
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.ok ? "var(--success)" : "var(--danger)" }}>{msg.text}</div>}
      {canSend && open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Seu token pessoal do ClickUp (ClickUp → Configurações → API da ClickUp, começa com pk_). Cada pessoa usa o seu: as tasks saem com o seu nome. Cole só aqui; fica criptografado e não volta para a tela.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="password" autoComplete="off" style={{ ...inp, minWidth: 260 }} placeholder={st.hasMyToken ? "•••• salvo (cole outro para trocar)" : "pk_…"} value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={!!busy || !token} onClick={() => run("token", async () => { setSt(await clickupApi.saveToken(token)); setToken(""); return "Seu token foi salvo."; })}>Salvar meu token</button>
            {st.hasMyToken && <button className="btn btn-sm" disabled={!!busy} onClick={() => run("rmtoken", async () => { setSt(await clickupApi.removeMyToken()); return "Seu token foi removido."; })}>Remover meu token</button>}
            {isAdmin && <button className="btn btn-sm" disabled={!!busy || !st.hasMyToken} onClick={() => run("lists", async () => { const l = await clickupApi.lists(); setLists(l); setPick(l[0]?.id || ""); return l.length ? `${l.length} lista(s). Escolha abaixo.` : "Nenhuma lista nesse token."; })}>{busy === "lists" ? "Buscando…" : "Buscar listas (boards)"}</button>}
          </div>
          {isAdmin && !!lists.length && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select style={{ ...inp, minWidth: 320 }} value={pick} onChange={(e) => setPick(e.target.value)}>{lists.map((l) => <option key={l.id} value={l.id}>{l.path}</option>)}</select>
              <button className="btn btn-primary btn-sm" disabled={!!busy || !pick} onClick={() => run("pick", async () => { const l = lists.find((x) => x.id === pick)!; setSt(await clickupApi.saveList(l)); return `As tasks vão para: ${l.path}.`; })}>Usar esta lista</button>
            </div>
          )}
          {isAdmin && configured && <button className="btn btn-sm" style={{ justifySelf: "start" }} onClick={() => setAdminOpen(!adminOpen)}>{adminOpen ? "▾" : "▸"} Opções do admin (espelhamento, envio automático, remover geral)</button>}
          {isAdmin && adminOpen && (<div style={{ display: "grid", gap: 10 }}>
          {isAdmin && configured && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12 }}>Quando a task mudar de status no ClickUp (ex.: “em andamento”), o bug muda aqui:</span>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => run("mirror", async () => { const r = await clickupApi.mirror(!st.mirrorOn); await load(); return r.mirrorOn ? "Espelhamento ligado." : "Espelhamento desligado."; })}>{st.mirrorOn ? "Desligar espelhamento" : "Ligar espelhamento automático"}</button>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Precisa do servidor publicado em https. Sem isso, use “↻ Sincronizar status”.</span>
            </div>
          )}
          {isAdmin && configured && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={st.autoSend} disabled={!!busy} onChange={(e) => run("auto", async () => { setSt(await clickupApi.setAutoSend(e.target.checked)); return e.target.checked ? "Agora todo bug criado na tela “Novo bug” vai direto ao ClickUp." : "Envio automático desligado: os bugs vão só quando você marcar e enviar."; })} />
              Enviar ao ClickUp assim que um bug for criado na tela “Novo bug” (bugs do Autopilot continuam manuais)
            </label>
          )}
          {isAdmin && (st.hasToken || st.listName) && <button className="btn btn-sm btn-danger" style={{ justifySelf: "start" }} onClick={() => { if (window.confirm("Isso apaga a lista, o espelhamento e o token antigo compartilhado para TODOS os usuários. Os tokens pessoais continuam salvos. Continuar?")) run("rm", async () => { await clickupApi.remove(); await load(); return "ClickUp removido."; }); }}>Remover configuração geral (lista e espelhamento, vale para todos)</button>}
          </div>)}
        </div>
      )}
    </div>
  );
}
