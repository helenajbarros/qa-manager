import crypto from "crypto";
import fs from "fs";
import path from "path";
import { query, execute } from "../database/connection";
import * as bugs from "./bugsService";
import * as notif from "./notificationsService";

/**
 * ClickUp ↔ QA Manager.
 *  - Enviar: bug do QA Manager vira task (só quando o usuário manda). O link da task vai em bugs.tracker_url.
 *  - Espelhar: quando a task muda de status no ClickUp, o status do bug muda aqui (webhook + "Sincronizar agora").
 * Token e segredo do webhook ficam criptografados em app_settings; nunca voltam para a tela.
 */
const API = "https://api.clickup.com/api/v2";
const KEY = "clickup";

const secretKey = () => crypto.createHash("sha256").update(`${process.env.JWT_SECRET || "qa_secret_fallback_change_in_production"}|clickup`).digest();
export function enc(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const e = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return "enc:" + [iv, c.getAuthTag(), e].map((b) => b.toString("base64")).join(".");
}
export function dec(stored?: string | null): string {
  if (!stored) return "";
  if (!stored.startsWith("enc:")) return stored;
  try {
    const [iv, tag, e] = stored.slice(4).split(".");
    const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(e, "base64")), d.final()]).toString("utf8");
  } catch { return ""; }
}

export interface Cfg { tokenEnc?: string; listId?: string; listName?: string; listPath?: string; teamId?: string; webhookId?: string; webhookSecretEnc?: string; webhookUrl?: string; autoSend?: boolean }

export async function loadCfg(): Promise<Cfg> {
  const r = await query<{ value: string }>("SELECT value FROM app_settings WHERE key=$1", [KEY]);
  try { return JSON.parse(r[0]?.value || "{}"); } catch { return {}; }
}
export async function saveCfg(cfg: Cfg): Promise<void> {
  const v = JSON.stringify(cfg);
  const ex = await query("SELECT key FROM app_settings WHERE key=$1", [KEY]);
  if (ex.length) await execute("UPDATE app_settings SET value=$1 WHERE key=$2", [v, KEY]);
  else await execute("INSERT INTO app_settings (key,value) VALUES ($1,$2)", [KEY, v]);
}
export async function status(userId?: number | null) {
  const c = await loadCfg();
  return { hasMyToken: !!(await userToken(userId)), hasToken: !!c.tokenEnc, listId: c.listId || null, listName: c.listName || null, listPath: c.listPath || null, mirrorOn: !!c.webhookId, autoSend: !!c.autoSend };
}

async function call(token: string, method: string, path: string, body?: unknown): Promise<any> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, { method, headers: { Authorization: token, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    } catch (e: any) {
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
      throw new Error(`Não consegui falar com o ClickUp (${e?.cause?.code || e?.message || "sem resposta"}).`);
    }
    if (res.status === 429 && attempt < 3) { await new Promise((r) => setTimeout(r, 4000 * attempt)); continue; }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new Error("O ClickUp recusou o token (401). Gere outro em ClickUp → Configurações → API da ClickUp.");
      throw new Error(`ClickUp ${res.status}: ${json?.err || json?.error || "erro"}`);
    }
    return json;
  }
  throw new Error("ClickUp não respondeu.");
}
const TOKEN_RE = /^pk_[A-Za-z0-9_]{10,}$/;
const userKey = (id: number) => `clickup_user_${id}`;
async function setSetting(key: string, value: string) {
  const ex = await query("SELECT key FROM app_settings WHERE key=$1", [key]);
  if (ex.length) await execute("UPDATE app_settings SET value=$1 WHERE key=$2", [value, key]);
  else await execute("INSERT INTO app_settings (key,value) VALUES ($1,$2)", [key, value]);
}
/** Token pessoal de quem está logado (cada usuário gera o seu no ClickUp). */
export async function userToken(userId?: number | null): Promise<string> {
  if (!userId) return "";
  const r = await query<{ value: string }>("SELECT value FROM app_settings WHERE key=$1", [userKey(userId)]);
  return dec(r[0]?.value);
}
export async function saveUserToken(userId: number, t: string): Promise<void> {
  const v = String(t || "").trim();
  if (!TOKEN_RE.test(v)) throw new Error("Isso não parece um token pessoal do ClickUp (começa com pk_). Pegue em ClickUp → Configurações → API da ClickUp.");
  await setSetting(userKey(userId), enc(v));
}
export async function removeUserToken(userId: number): Promise<void> {
  await execute("DELETE FROM app_settings WHERE key=$1", [userKey(userId)]);
}
/** Para listar boards, espelhar e sincronizar: token de quem pediu, senão o token do admin. */
async function token(userId?: number | null): Promise<string> {
  const t = (await userToken(userId)) || dec((await loadCfg()).tokenEnc);
  if (!t) throw new Error("Cole o seu token pessoal do ClickUp primeiro (botão ⚙ ClickUp).");
  return t;
}

export async function saveToken(t: string): Promise<void> {
  const v = String(t || "").trim();
  if (!/^pk_[A-Za-z0-9_]{10,}$/.test(v)) throw new Error("Isso não parece um token pessoal do ClickUp (começa com pk_). Pegue em ClickUp → Configurações → Apps → API Token.");
  await saveCfg({ ...(await loadCfg()), tokenEnc: enc(v) });
}
export async function saveList(l: { id: string; name: string; path: string; teamId: string }): Promise<void> {
  await saveCfg({ ...(await loadCfg()), listId: String(l.id).replace(/\D/g, ""), listName: String(l.name).slice(0, 120), listPath: String(l.path).slice(0, 240), teamId: String(l.teamId).replace(/\D/g, "") });
}
export async function setAutoSend(on: boolean): Promise<void> {
  await saveCfg({ ...(await loadCfg()), autoSend: !!on });
}
export async function removeCfg(): Promise<void> {
  const c = await loadCfg();
  try { if (c.webhookId && dec(c.tokenEnc)) await call(dec(c.tokenEnc), "DELETE", `/webhook/${c.webhookId}`); } catch { /* segue */ }
  await execute("DELETE FROM app_settings WHERE key=$1", [KEY]);
}

export interface ListOption { id: string; name: string; path: string; teamId: string }
export async function lists(userId?: number | null): Promise<ListOption[]> {
  const t = await token(userId);
  const out: ListOption[] = [];
  for (const team of (await call(t, "GET", "/team")).teams || []) {
    for (const s of (await call(t, "GET", `/team/${team.id}/space?archived=false`)).spaces || []) {
      for (const l of (await call(t, "GET", `/space/${s.id}/list?archived=false`)).lists || []) out.push({ id: String(l.id), name: l.name, path: `${team.name} / ${s.name} / ${l.name}`, teamId: String(team.id) });
      for (const f of (await call(t, "GET", `/space/${s.id}/folder?archived=false`)).folders || []) for (const l of f.lists || []) out.push({ id: String(l.id), name: l.name, path: `${team.name} / ${s.name} / ${f.name} / ${l.name}`, teamId: String(team.id) });
      if (out.length > 300) return out;
    }
  }
  return out;
}

const PRIORITY: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 }; // 1 urgente … 4 baixa

export function buildTask(b: any): { name: string; markdown_description: string; priority: number; tags: string[] } {
  const sec = (h: string, v?: string | null) => (v && String(v).trim() ? `## ${h}\n${String(v).trim()}\n\n` : "");
  const tags = [...new Set(["qa-manager", "bug", String(b.severity || "").toLowerCase(), b.module_name ? String(b.module_name).toLowerCase().replace(/\s+/g, "-") : ""].filter(Boolean))];
  const ctx = [b.module_name && `Módulo: ${b.module_name}`, b.environment_name || b.environment ? `Ambiente: ${b.environment_name || b.environment}` : "", b.version && `Versão: ${b.version}`, b.os && `SO: ${b.os}`, b.browser && `Navegador: ${b.browser}`, b.test_case_title && `Caso de teste: ${b.test_case_title}`].filter(Boolean).join(" · ");
  const md =
    `**Severidade:** ${b.severity || "-"} · **Prioridade:** ${b.priority || "-"}${ctx ? `\n\n${ctx}` : ""}\n\n` +
    sec("Descrição", b.description) +
    sec("Impacto no negócio", b.impact) +
    sec("Passos para reproduzir", b.steps) +
    sec("Resultado esperado", b.expected_result) +
    sec("Resultado obtido", b.actual_result) +
    sec("Observações", b.comment) +
    (b.evidence_url ? `## Evidência\n${b.evidence_url}\n\n` : "") +
    `_Bug #${b.id} do QA Manager${b.created_by_name ? `, registrado por ${b.created_by_name}` : ""}._`;
  return { name: String(b.title).slice(0, 250), markdown_description: md.slice(0, 15000), priority: PRIORITY[String(b.priority)] || 3, tags };
}

export const isClickupUrl = (u?: string | null) => /clickup\.com\/t\//i.test(String(u || ""));
export const taskIdOf = (u?: string | null) => (String(u || "").match(/clickup\.com\/t\/(?:[^/]+\/)?([A-Za-z0-9_-]+)/i) || [])[1] || null;

export interface SendResult { sent: { id: number; title: string; url: string; attached?: number }[]; skipped: { id: number; title: string; reason: string }[]; failed: { id: number; title: string; error: string }[] }

/** Anexa na task os arquivos de evidência do bug (prints etc.). Devolve quantos foram. Erros não derrubam o envio. */
async function attachFiles(t: string, taskId: string, files: any[]): Promise<number> {
  let n = 0;
  const dir = process.env.QA_UPLOAD_DIR || "uploads";
  for (const f of (files || []).slice(0, 10)) {
    try {
      const full = path.resolve(dir, String(f.filename));
      if (!fs.existsSync(full) || fs.statSync(full).size > 90 * 1024 * 1024) continue;
      const form = new FormData();
      form.append("attachment", new Blob([fs.readFileSync(full)], { type: f.mimetype || "application/octet-stream" }), String(f.originalname || f.filename));
      const res = await fetch(`${API}/task/${taskId}/attachment`, { method: "POST", headers: { Authorization: t }, body: form, signal: AbortSignal.timeout(60000) });
      if (res.ok) n++;
    } catch { /* segue com os outros */ }
  }
  return n;
}

/** Status do bug (QA Manager) → nome de status que existe na lista do ClickUp (cada lista tem os seus). */
export function pickClickupStatus(target: "open" | "in_progress" | "fixed" | "closed", listStatuses: { status: string; type?: string }[]): string | null {
  const cands = (listStatuses || []).filter((x) => mapStatus(x) === target);
  return cands[0]?.status || null;
}

/** QA Manager → ClickUp: quando o status do bug muda aqui, muda também na task. Quem fez a mudança precisa ter token (ou o admin ter). */
export async function pushStatus(bugId: number, newStatus: string, userId?: number | null): Promise<void> {
  const b: any = (await query<any>("SELECT id,tracker_url FROM bugs WHERE id=$1", [bugId]))[0];
  const taskId = taskIdOf(b?.tracker_url);
  if (!taskId) return;
  const target = (["open", "in_progress", "fixed", "closed"] as const).find((x) => x === newStatus);
  if (!target) return;
  try {
    const t = await token(userId);
    const task = await call(t, "GET", `/task/${taskId}`);
    if (mapStatus(task.status) === target) return; // já está igual: evita eco com o webhook
    const list = await call(t, "GET", `/list/${task.list?.id}`);
    const name = pickClickupStatus(target, list.statuses || []);
    if (!name) { await bugs.logActivity(bugId, userId ?? null, "não consegui mudar o status no ClickUp", `a lista não tem um status equivalente a "${target}"`); return; }
    await call(t, "PUT", `/task/${taskId}`, { status: name });
    await bugs.logActivity(bugId, userId ?? null, "status enviado ao ClickUp", name);
  } catch (e: any) {
    await bugs.logActivity(bugId, userId ?? null, "falha ao mudar o status no ClickUp", String(e.message).slice(0, 160)).catch(() => {});
  }
}

/** Envia os bugs escolhidos. Quem já tem link do ClickUp em tracker_url é pulado. */
export async function sendBugs(ids: number[], userId?: number): Promise<SendResult> {
  // envio: SEMPRE com o token de quem enviou, para a task sair com o nome dele
  const t = await userToken(userId);
  if (!t) throw new Error("Você ainda não colou o seu token do ClickUp. Abra ⚙ ClickUp e cole o seu (assim a task sai no seu nome).");
  const cfg = await loadCfg();
  if (!cfg.listId) throw new Error("O admin precisa escolher a lista (board) do ClickUp.");
  const res: SendResult = { sent: [], skipped: [], failed: [] };
  for (const id of ids.slice(0, 100)) {
    const b: any = await bugs.findById(id);
    if (!b) continue;
    if (isClickupUrl(b.tracker_url)) { res.skipped.push({ id, title: b.title, reason: "já está no ClickUp" }); continue; }
    try {
      const task = await call(t, "POST", `/list/${cfg.listId}/task`, buildTask(b));
      const url = String(task.url || `https://app.clickup.com/t/${task.id}`);
      await execute("UPDATE bugs SET tracker_url=$1 WHERE id=$2", [url, id]);
      await bugs.logActivity(id, userId ?? null, "enviou ao ClickUp", url);
      const attached = await attachFiles(t, String(task.id), b.evidence_files || []);
      res.sent.push({ id, title: b.title, url, attached });
    } catch (e: any) {
      res.failed.push({ id, title: b.title, error: String(e.message).slice(0, 160) });
      if (/401/.test(String(e.message))) break;
    }
  }
  return res;
}

/** Status do ClickUp → status do bug (open, in_progress, fixed, closed). null = não sei mapear (não mexe). */
export function mapStatus(s: { status?: string; type?: string } | undefined | null): "open" | "in_progress" | "fixed" | "closed" | null {
  if (!s) return null;
  const type = String(s.type || "").toLowerCase();
  const name = String(s.status || "").toLowerCase();
  if (type === "closed") return "closed";
  if (type === "done") return /fechad|closed|cancel/.test(name) ? "closed" : "fixed";
  if (type === "open") return "open";
  if (/andamento|progress|doing|desenvolv|fazendo|review|revis|test|homolog|valida/.test(name)) return "in_progress";
  if (/conclu|complete|done|resolv|corrig|pronto|entregue/.test(name)) return "fixed";
  if (/fechad|closed|cancel/.test(name)) return "closed";
  if (/to do|a fazer|aberto|open|backlog|novo|pendente/.test(name)) return "open";
  return null;
}

export interface CuUser { id?: number | string; username?: string; email?: string }
const who = (u?: CuUser | null) => String(u?.username || u?.email || "").trim();

/** Acha o usuário do QA Manager que corresponde a uma pessoa do ClickUp: primeiro pelo e-mail, depois pelo nome. */
export async function findQmUser(cu?: CuUser | null): Promise<{ id: number; name: string } | null> {
  if (!cu) return null;
  if (cu.email) {
    const r = await query<any>("SELECT id,name FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1", [String(cu.email).trim()]);
    if (r[0]) return { id: r[0].id, name: r[0].name };
  }
  if (cu.username) {
    const r = await query<any>("SELECT id,name FROM users WHERE LOWER(name)=LOWER($1) LIMIT 2", [String(cu.username).trim()]);
    if (r.length === 1) return { id: r[0].id, name: r[0].name };
  }
  return null;
}

/** Aplica no bug o status que a task tem no ClickUp e registra QUEM moveu (nome do usuário do ClickUp). */
export async function mirrorTask(taskId: string, clickupStatus?: { status?: string; type?: string }, userId?: number | null, actor?: CuUser | null): Promise<{ id: number; from: string; to: string; clickup: string } | null> {
  const rows = await query<any>("SELECT id,status,closed_by_archive FROM bugs WHERE tracker_url LIKE $1", [`%/t/${taskId}%`]);
  const bug = rows[0];
  if (!bug) return null;
  let st = clickupStatus;
  if (!st) st = (await call(await token(userId), "GET", `/task/${taskId}`)).status;
  const to = mapStatus(st);
  if (!to || to === bug.status) return null;
  await execute("UPDATE bugs SET status=$1 WHERE id=$2", [to, bug.id]);
  const qm = await findQmUser(actor);
  // mesmo registro das mudanças feitas aqui (alimenta os relatórios de tempo de resolução), atribuído a quem moveu quando é usuário do QA Manager
  await bugs.logActivity(bug.id, qm?.id ?? null, "alterou o status", `${bug.status} → ${to}`);
  await bugs.logActivity(bug.id, null, `movido no ClickUp${who(actor) ? ` por ${who(actor)}` : ""}`, `status no ClickUp: ${st?.status || "?"}`);
  return { id: bug.id, from: bug.status, to, clickup: String(st?.status || "") };
}

/** Espelha o responsável: quem foi atribuído à task no ClickUp vira o responsável do bug. Com usuário do QA Manager (mesmo e-mail/nome) vira o responsável de fato; sem usuário, o NOME do ClickUp aparece mesmo assim. */
export async function mirrorAssignee(taskId: string, change: { add?: CuUser; remove?: CuUser; all?: CuUser[] }, actor?: CuUser | null): Promise<{ id: number; to: string | null } | null> {
  const bug = (await query<any>("SELECT id,title,assigned_to_id,clickup_assignee FROM bugs WHERE tracker_url LIKE $1", [`%/t/${taskId}%`]))[0];
  if (!bug) return null;
  const by = who(actor);
  if (change.remove && !change.add && !change.all) {
    const qm = await findQmUser(change.remove);
    const name = who(change.remove);
    const matchesUser = qm && bug.assigned_to_id === qm.id;
    const matchesName = !qm && name && bug.clickup_assignee && bug.clickup_assignee.split(", ").includes(name);
    if (matchesUser || matchesName) {
      await execute("UPDATE bugs SET assigned_to_id=NULL, clickup_assignee=NULL WHERE id=$1", [bug.id]);
      await bugs.logActivity(bug.id, null, `responsável removido no ClickUp${by ? ` por ${by}` : ""}`, qm?.name || name);
      return { id: bug.id, to: null };
    }
    return null;
  }
  const list = change.all || (change.add ? [change.add] : []);
  if (!list.length) return null;
  let target: { id: number; name: string } | null = null;
  for (const cu of list) { target = await findQmUser(cu); if (target) break; }
  if (target) {
    if (bug.assigned_to_id === target.id && !bug.clickup_assignee) return null;
    await execute("UPDATE bugs SET assigned_to_id=$1, clickup_assignee=NULL WHERE id=$2", [target.id, bug.id]);
    await bugs.logActivity(bug.id, null, `responsável alterado no ClickUp${by ? ` por ${by}` : ""}`, `→ ${target.name}`);
    if (bug.assigned_to_id !== target.id) await notif.create({ user_id: target.id, type: "assigned", message: `Você foi atribuído (no ClickUp) ao bug #${bug.id}: "${bug.title}"`, link: `/bugs/${bug.id}` });
    return { id: bug.id, to: target.name };
  }
  // ninguém tem usuário no QA Manager: guarda o nome do ClickUp para aparecer na tela
  const names = list.map(who).filter(Boolean).join(", ");
  if (!names || (bug.clickup_assignee === names && !bug.assigned_to_id)) return null;
  await execute("UPDATE bugs SET assigned_to_id=NULL, clickup_assignee=$1 WHERE id=$2", [names.slice(0, 200), bug.id]);
  await bugs.logActivity(bug.id, null, `responsável alterado no ClickUp${by ? ` por ${by}` : ""}`, `→ ${names} (sem usuário no QA Manager; cadastre com o mesmo e-mail para vincular)`);
  return { id: bug.id, to: names };
}

/** "Sincronizar agora": confere no ClickUp os bugs que já foram para lá e ainda não estão fechados. */
export async function syncAll(projectId?: number, userId?: number | null): Promise<{ checked: number; changed: { id: number; from: string; to: string; clickup: string }[]; assignees: { id: number; to: string | null }[]; unmapped: string[]; failed: number }> {
  const t = await token(userId);
  const rows = await query<any>(`SELECT id,tracker_url,status FROM bugs WHERE tracker_url LIKE '%clickup.com/t/%' AND status <> 'closed' ${projectId ? "AND project_id=$1" : ""} ORDER BY id DESC LIMIT 200`, projectId ? [projectId] : []);
  const out = { checked: 0, changed: [] as { id: number; from: string; to: string; clickup: string }[], assignees: [] as { id: number; to: string | null }[], unmapped: [] as string[], failed: 0 };
  let i = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (i < rows.length) {
      const r = rows[i++];
      const id = taskIdOf(r.tracker_url);
      if (!id) continue;
      try {
        const task = await call(t, "GET", `/task/${id}`);
        out.checked++;
        try { const a = await mirrorAssignee(id, { all: (task.assignees || []).map((x: any) => ({ id: x.id, username: x.username, email: x.email })) }); if (a) out.assignees.push(a); } catch { /* responsável é extra */ }
        const to = mapStatus(task.status);
        if (!to) { const n = String(task.status?.status || ""); if (n && !out.unmapped.includes(n)) out.unmapped.push(n); continue; }
        if (to !== r.status) {
          await execute("UPDATE bugs SET status=$1 WHERE id=$2", [to, r.id]);
          await bugs.logActivity(r.id, null, "alterou o status", `${r.status} → ${to}`);
          await bugs.logActivity(r.id, null, "movido no ClickUp (sincronização)", `status no ClickUp: ${task.status?.status}`);
          out.changed.push({ id: r.id, from: r.status, to, clickup: String(task.status?.status || "") });
        }
      } catch { out.failed++; }
    }
  }));
  return out;
}

/** Liga o espelhamento automático: cria o webhook no ClickUp apontando para este servidor. */
export async function enableMirror(publicBase: string, userId?: number | null): Promise<{ url: string }> {
  const t = await token(userId);
  const cfg = await loadCfg();
  if (!cfg.teamId || !cfg.listId) throw new Error("Escolha a lista do ClickUp antes de ligar o espelhamento.");
  const url = `${publicBase.replace(/\/$/, "")}/api/integrations/clickup/webhook`;
  if (!/^https:\/\//i.test(url)) throw new Error("O ClickUp só aceita endereço https. Use o servidor publicado (ex.: Render), não localhost.");
  if (cfg.webhookId) { try { await call(t, "DELETE", `/webhook/${cfg.webhookId}`); } catch { /* já não existia */ } }
  const w = await call(t, "POST", `/team/${cfg.teamId}/webhook`, { endpoint: url, events: ["taskStatusUpdated", "taskAssigneeUpdated"], list_id: Number(cfg.listId) });
  await saveCfg({ ...cfg, webhookId: String(w.id || w.webhook?.id), webhookSecretEnc: enc(String(w.webhook?.secret || "")), webhookUrl: url });
  return { url };
}
export async function disableMirror(userId?: number | null): Promise<void> {
  const cfg = await loadCfg();
  try { if (cfg.webhookId) await call(await token(userId), "DELETE", `/webhook/${cfg.webhookId}`); } catch { /* segue */ }
  await saveCfg({ ...cfg, webhookId: undefined, webhookSecretEnc: undefined, webhookUrl: undefined });
}

/** Confere a assinatura do webhook (HMAC-SHA256 do corpo com o segredo do webhook). */
export async function verifySignature(raw: Buffer, signature?: string): Promise<boolean> {
  const secret = dec((await loadCfg()).webhookSecretEnc);
  if (!secret || !signature) return false;
  const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(h), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
