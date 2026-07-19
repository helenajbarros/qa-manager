import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { testPlansApi, cyclesApi, modulesApi, bugsApi, testCasesApi } from "../services/resources.js";
import { useProject } from "../context/ProjectContext.js";
import { Loading } from "../components/UI.js";

const fmtDate = (d: string) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";
const riskColor = (r: string) => r === "ALTO" ? "#EF4444" : r === "MÉDIO" ? "#F59E0B" : "#10B981";

const DEF_ENTRY = `• Build disponível e estável no ambiente de teste
• Casos de teste cadastrados e revisados
• Ambiente configurado e acessível
• Equipe de QA alocada`;

const DEF_EXIT = `• Taxa de sucesso ≥ 70% nos casos executados
• Nenhum bug crítico ou alto em aberto
• Cobertura mínima de 80% dos casos de teste
• Relatório de encerramento gerado`;

const DEF_STRATEGY = `• Testes funcionais baseados nos casos de teste cadastrados
• Testes exploratórios nos módulos de maior risco
• Validação de bugs corrigidos em ciclos anteriores (regressão)
• Registro de evidências para bugs encontrados`;

function Field({ label, children }: any) {
  return (
    <div style={{padding:"10px 12px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--border)"}}>
      <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{label}</div>
      <div style={{fontWeight:500,fontSize:13}}>{children}</div>
    </div>
  );
}

function Section({ num, title, children }: any) {
  return (
    <div className="card" style={{marginBottom:10,padding:"12px 14px"}}>
      <h2 style={{fontSize:12,fontWeight:700,color:"var(--accent)",marginBottom:10,
        textTransform:"uppercase",letterSpacing:".06em",borderBottom:"1px solid var(--border)",paddingBottom:6}}>
        {num}. {title}
      </h2>
      {children}
    </div>
  );
}

function EditText({ value, onChange, rows=3, canEdit, placeholder="" }: any) {
  return canEdit ? (
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
      style={{width:"100%",padding:"6px 8px",borderRadius:6,border:"1px solid var(--border)",
        fontSize:12,fontFamily:"inherit",resize:"vertical",lineHeight:1.5}} />
  ) : (
    <pre style={{fontSize:12,lineHeight:1.6,whiteSpace:"pre-wrap",color:"var(--text)",margin:0}}>{value||"—"}</pre>
  );
}

export default function TestPlan() {
  const { id: cycleId } = useParams<{id: string}>();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const pid = currentProject?.id;

  const [cycle, setCycle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    objective: "", out_of_scope: "",
    entry_criteria: DEF_ENTRY, exit_criteria: DEF_EXIT,
    strategy: DEF_STRATEGY, risks: "",
    approver_qa: "", approver_manager: "",
    date_qa: "", date_manager: "",
    modules_scope: [] as any[],
  });

  const set = (k: string) => (v: any) => setForm(f => ({...f, [k]: v}));
  const [planSaved, setPlanSaved] = useState(false);

  function downloadHTML() {
    const fmtBR = (d: string) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "___/___/______";
    const rC = (r: string) => r==="ALTO"?"#EF4444":r==="MÉDIO"?"#F59E0B":"#10B981";
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Plano de Teste — ${currentProject?.name||""}${cycle?.version?` v${cycle.version}`:""}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;padding:40px;max-width:900px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:22px;font-weight:700;margin-bottom:4px}
      .sub{font-size:13px;color:#64748B;margin-bottom:28px}
      .section{margin-bottom:20px;break-inside:avoid}
      .section-title{font-size:12px;font-weight:700;color:#1E3A5F;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #E2E8F0;padding-bottom:6px;margin-bottom:12px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:0}
      .field{padding:8px 10px;background:#F8FAFC;border-radius:6px;border:1px solid #E2E8F0}
      .field-label{font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
      .field-val{font-size:12px;font-weight:500}
      pre{font-size:12px;line-height:1.7;white-space:pre-wrap;font-family:inherit}
      .mod{border:1px solid #E2E8F0;border-radius:6px;padding:8px 10px;margin-bottom:6px}
      .mod-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
      .badge{font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px}
      .reason{font-size:11px;color:#64748B;margin-top:2px}
      .approval{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
      .appr-box{border:1px solid #E2E8F0;border-radius:6px;padding:12px}
      .appr-name{font-size:13px;font-weight:600;min-height:20px;border-bottom:1px solid #1E293B;padding-bottom:4px;margin-bottom:4px;margin-top:20px}
      .appr-date{font-size:11px;color:#64748B}
      @media print{body{padding:20px}}
    </style></head><body>
    <h1>📝 Plano de Teste — ${currentProject?.name||""}${cycle?.version?` — v${cycle.version}`:""}</h1>
    <div class="sub">Ciclo: ${cycle?.name||"—"} | ${cycle?.start_date?`${fmtBR(cycle.start_date)} → ${cycle.end_date?fmtBR(cycle.end_date):"em aberto"}`:"—"}</div>

    <div class="section">
      <div class="section-title">1. Identificação</div>
      <div class="grid">
        <div class="field"><div class="field-label">Projeto</div><div class="field-val">${currentProject?.name||"—"}</div></div>
        <div class="field"><div class="field-label">Ciclo</div><div class="field-val">${cycle?.name||"—"}</div></div>
        <div class="field"><div class="field-label">Versão</div><div class="field-val">${cycle?.version?`v${cycle.version}`:"—"}</div></div>
        <div class="field"><div class="field-label">Período</div><div class="field-val">${cycle?.start_date?`${fmtBR(cycle.start_date)} → ${cycle.end_date?fmtBR(cycle.end_date):"em aberto"}`:"—"}</div></div>
        <div class="field"><div class="field-label">Tipos</div><div class="field-val">${(cycle?.test_types ? (typeof cycle.test_types === 'string' ? cycle.test_types.split(',') : cycle.test_types) : []).join(", ")||"—"}</div></div>
        <div class="field"><div class="field-label">Total de Casos</div><div class="field-val">${form.modules_scope.filter(m=>m.included).reduce((a,m)=>a+m.total_cases,0)} casos</div></div>
      </div>
    </div>

    <div class="section"><div class="section-title">2. Objetivo</div><pre>${form.objective||"—"}</pre></div>

    <div class="section">
      <div class="section-title">3. Escopo dos Testes</div>
      ${form.modules_scope.filter(m=>m.included).map(m=>`
        <div class="mod">
          <div class="mod-header">
            <strong style="font-size:12px">${m.name}</strong>
            <span style="font-size:11px;color:#64748B">${m.total_cases} casos</span>
            <span style="font-size:11px;color:#64748B">${m.bugs} bug(s)</span>
            <span class="badge" style="background:${rC(m.risk)}20;color:${rC(m.risk)}">${m.risk}</span>
          </div>
          <div class="reason">Por que será testado: ${m.reason}</div>
        </div>`).join("")}
      ${form.out_of_scope ? `<div style="margin-top:10px"><strong style="font-size:11px">Fora do escopo:</strong><br><pre style="font-size:11px">${form.out_of_scope}</pre></div>` : ""}
    </div>

    <div class="section"><div class="section-title">4. Critérios de Entrada</div><pre>${form.entry_criteria}</pre></div>
    <div class="section"><div class="section-title">5. Critérios de Saída (Quality Gate)</div><pre>${form.exit_criteria}</pre></div>
    <div class="section"><div class="section-title">6. Estratégia de Teste</div><pre>${form.strategy}</pre></div>
    <div class="section"><div class="section-title">7. Riscos</div><pre>${form.risks||"—"}</pre></div>

    <div class="section">
      <div class="section-title">8. Aprovação</div>
      <div class="approval">
        <div class="appr-box">
          <div class="field-label">Elaborado por (QA)</div>
          <div class="appr-name">${form.approver_qa||""}</div>
          <div class="appr-date">Data: ${fmtBR((form as any).date_qa)}</div>
        </div>
        <div class="appr-box">
          <div class="field-label">Aprovado por (Gestor)</div>
          <div class="appr-name">${form.approver_manager||""}</div>
          <div class="appr-date">Data: ${fmtBR((form as any).date_manager)}</div>
        </div>
      </div>
    </div>


    </body></html>`;
    // Abre em nova janela e aciona impressão automaticamente (salvar como PDF)
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  }

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    cyclesApi.get(cycleId).then(async (cR: any) => {
      const c = cR?.data ?? cR;
      const cpid = c?.project_id || pid;
      setCycle(c);

      const [mR, bR, tcR, pR] = await Promise.all([
        modulesApi.list(cpid ? {project_id: cpid} : {}),
        bugsApi.list(cpid ? {project_id: cpid} : {}),
        testCasesApi.list(cpid ? {project_id: cpid, limit: 9999} : {limit: 9999}),
        testPlansApi.get(cycleId),
      ]);

      const mods = (mR as any)?.data ?? mR ?? [];
      const bugsData = ((bR as any)?.data ?? bR ?? []) as any[];
      const tcs = ((tcR as any)?.data ?? tcR ?? []) as any[];
      const p = (pR as any)?.data ?? pR;

      // Casos por módulo
      const casesByMod: Record<number,number> = {};
      tcs.forEach((tc: any) => {
        if (tc.module_id) casesByMod[tc.module_id] = (casesByMod[tc.module_id]||0) + 1;
      });

      // Bugs por módulo
      const bugsByMod: Record<string,number> = {};
      bugsData.forEach((b: any) => {
        const mod = b.module_name || b.module;
        if (mod) bugsByMod[mod] = (bugsByMod[mod]||0) + 1;
      });

      const modulesScope = mods.map((m: any) => {
        const tc = casesByMod[m.id] || 0;
        const bc = bugsByMod[m.name] || 0;
        const risk = bc > 5 ? "ALTO" : bc > 2 ? "MÉDIO" : "BAIXO";
        const reason = bc > 5 ? `Módulo crítico com ${bc} bugs históricos. Requer atenção especial.`
          : bc > 2 ? `${bc} bugs encontrados em ciclos anteriores. Monitorar de perto.`
          : m.name?.toLowerCase().includes("login") ? "Funcionalidade base. Qualquer falha impede o uso."
          : bc === 0 ? "Módulo estável. Validação de regressão."
          : `${bc} bug(s) histórico(s). Validação necessária.`;
        return { id: m.id, name: m.name, total_cases: tc, bugs: bc, risk, included: tc > 0, reason };
      }).filter((m: any) => m.total_cases > 0 || true);

      if (p?.objective) {
        setForm({
          objective: p.objective||"", out_of_scope: p.out_of_scope||"",
          entry_criteria: p.entry_criteria||DEF_ENTRY, exit_criteria: p.exit_criteria||DEF_EXIT,
          strategy: p.strategy||DEF_STRATEGY, risks: p.risks||"",
          approver_qa: p.approver_qa||"", approver_manager: p.approver_manager||"",
          date_qa: p.date_qa||"", date_manager: p.date_manager||"",
          modules_scope: p.modules_scope||modulesScope,
        });
      } else {
        const types = c?.test_types ? (typeof c.test_types === 'string' ? c.test_types.split(',').map((t:string)=>t.trim()) : c.test_types) : [];
        const proj = currentProject?.name || "sistema";
        const ver = c?.version ? ` v${c.version}` : "";
        const obj = types.includes("regression")
          ? `Validar que as alterações realizadas na versão${ver} não introduziram regressões nas funcionalidades existentes do ${proj}.`
          : types.includes("smoke")
          ? `Verificar as funcionalidades críticas do ${proj}${ver}, garantindo estabilidade mínima para testes aprofundados.`
          : `Validar as funcionalidades do ${proj} no ciclo ${c?.name||""}${ver}, garantindo qualidade antes da entrega.`;
        const autoRisks = modulesScope
          .filter((m: any) => m.risk !== "BAIXO")
          .map((m: any) => `• ${m.name}: risco ${m.risk} — ${m.bugs > 5 ? "histórico elevado de bugs" : "bugs anteriores identificados"}`)
          .join("\n") || "• Nenhum risco crítico identificado com base no histórico.";
        setForm(f => ({...f, objective: obj, risks: autoRisks, modules_scope: modulesScope}));
      }
    }).finally(() => setLoading(false));
  }, [cycleId]);

  async function handleSave() {
    if (!cycleId) return;
    setSaving(true);
    try {
      await testPlansApi.save(cycleId, form);
      setSaved(true);
      setPlanSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  function updMod(idx: number, field: string, value: any) {
    setForm(f => ({...f, modules_scope: f.modules_scope.map((m,i) => i===idx ? {...m,[field]:value} : m)}));
  }

  if (loading) return <Loading />;

  const totalCases = form.modules_scope.filter(m=>m.included).reduce((a,m)=>a+m.total_cases,0);
  const saveBtn = (
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{minWidth:90}}>
        {saving ? "⏳ Salvando..." : saved ? "✅ Salvo!" : "💾 Salvar"}
      </button>
      {planSaved && (
        <button className="btn" onClick={downloadHTML}
          style={{fontSize:12,background:"#F0FDF4",color:"#065F46",border:"1px solid #BBF7D0"}}>
          📄 PDF
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      {/* Header compacto */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <button className="btn" onClick={()=>navigate(-1)} style={{fontSize:12}}>← Voltar</button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:16,fontWeight:700,margin:0}}>📝 Plano de Teste</h1>
          <div style={{fontSize:11,color:"var(--text-muted)"}}>
            {cycle?.name}{cycle?.version ? ` — v${cycle.version}` : ""}
            {cycle?.start_date ? ` | ${fmtDate(cycle.start_date)} → ${cycle.end_date ? fmtDate(cycle.end_date) : "em aberto"}` : ""}
          </div>
        </div>
        {canEdit && saveBtn}
      </div>

      {/* 1. Identificação — grid compacto */}
      <Section num="1" title="Identificação">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
          <Field label="Projeto">{currentProject?.name||"—"}</Field>
          <Field label="Ciclo">{cycle?.name||"—"}</Field>
          <Field label="Versão">{cycle?.version ? `v${cycle.version}` : "—"}</Field>
          <Field label="Período">
            {cycle?.start_date ? `${fmtDate(cycle.start_date)} → ${cycle.end_date ? fmtDate(cycle.end_date) : "em aberto"}` : "—"}
          </Field>
          <Field label="Tipos de Teste">{(cycle?.test_types ? (typeof cycle.test_types === 'string' ? cycle.test_types.split(',').map((t:string)=>t.trim()) : cycle.test_types) : []).join(", ") || "—"}</Field>
          <Field label="Total de Casos (escopo)">{totalCases} casos</Field>
        </div>
      </Section>

      {/* 2. Objetivo */}
      <Section num="2" title="Objetivo">
        <EditText value={form.objective} onChange={set("objective")} rows={2} canEdit={canEdit}
          placeholder="Descreva o objetivo deste ciclo de testes..." />
      </Section>

      {/* 3. Escopo */}
      <Section num="3" title="Escopo dos Testes">
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
          {form.modules_scope.map((m, idx) => (
            <div key={m.id||idx} style={{border:"1px solid var(--border)",borderRadius:6,padding:"8px 10px",
              background:m.included?"var(--card)":"var(--bg)",opacity:m.included?1:0.55}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                {canEdit && (
                  <input type="checkbox" checked={m.included} onChange={e=>updMod(idx,"included",e.target.checked)}
                    style={{width:14,height:14,cursor:"pointer",flexShrink:0}} />
                )}
                <span style={{fontWeight:600,fontSize:12}}>{m.name}</span>
                <span style={{fontSize:11,color:"var(--text-muted)",background:"var(--bg)",
                  padding:"1px 6px",borderRadius:4,border:"1px solid var(--border)"}}>
                  {m.total_cases} casos
                </span>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>
                  {m.bugs} bug{m.bugs!==1?"s":""}
                </span>
                <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,
                  background:riskColor(m.risk)+"20",color:riskColor(m.risk)}}>
                  {m.risk}
                </span>
              </div>
              {m.included && (
                <div style={{marginTop:6,paddingLeft:canEdit?22:0}}>
                  <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:2,fontWeight:600}}>Por que será testado:</div>
                  {canEdit ? (
                    <input value={m.reason} onChange={e=>updMod(idx,"reason",e.target.value)}
                      style={{width:"100%",padding:"4px 8px",borderRadius:4,border:"1px solid var(--border)",fontSize:11}} />
                  ) : <p style={{fontSize:11,color:"var(--text)",margin:0}}>{m.reason}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>O que NÃO será testado:</div>
        <EditText value={form.out_of_scope} onChange={set("out_of_scope")} rows={2} canEdit={canEdit}
          placeholder="Ex: Testes de performance, integrações externas..." />
      </Section>

      {/* 4 e 5 lado a lado */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <Section num="4" title="Critérios de Entrada">
          <EditText value={form.entry_criteria} onChange={set("entry_criteria")} rows={5} canEdit={canEdit} />
        </Section>
        <Section num="5" title="Critérios de Saída (Quality Gate)">
          <EditText value={form.exit_criteria} onChange={set("exit_criteria")} rows={5} canEdit={canEdit} />
        </Section>
      </div>

      {/* 6. Estratégia */}
      <Section num="6" title="Estratégia de Teste">
        <EditText value={form.strategy} onChange={set("strategy")} rows={4} canEdit={canEdit} />
      </Section>

      {/* 7. Riscos */}
      <Section num="7" title="Riscos Identificados">
        <EditText value={form.risks} onChange={set("risks")} rows={4} canEdit={canEdit}
          placeholder="Liste os riscos identificados..." />
      </Section>

      {/* 8. Aprovação */}
      <Section num="8" title="Aprovação">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[
            ["Elaborado por (QA)", "approver_qa", "Nome do QA responsável", "date_qa"],
            ["Aprovado por (Gestor)", "approver_manager", "Nome do gestor/cliente", "date_manager"],
          ].map(([label, field, placeholder, dateField]) => (
            <div key={field} style={{border:"1px solid var(--border)",borderRadius:6,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{label}</div>
              {canEdit ? (
                <input value={(form as any)[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                  placeholder={placeholder as string}
                  style={{width:"100%",padding:"5px 8px",borderRadius:4,border:"1px solid var(--border)",fontSize:12,marginBottom:8}} />
              ) : (
                <div style={{fontSize:12,fontWeight:500,minHeight:20,marginBottom:8}}>
                  {(form as any)[field] || <span style={{color:"var(--text-muted)"}}>Não preenchido</span>}
                </div>
              )}
              <div style={{borderTop:"1px solid var(--border)",paddingTop:8,marginTop:4}}>
                <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:600,marginBottom:3}}>Data:</div>
                {canEdit ? (
                  <input type="date" value={(form as any)[dateField]}
                    onChange={e=>setForm(f=>({...f,[dateField]:e.target.value}))}
                    style={{padding:"4px 8px",borderRadius:4,border:"1px solid var(--border)",fontSize:12,width:"100%"}} />
                ) : (
                  <div style={{fontSize:12}}>
                    {(form as any)[dateField]
                      ? new Date((form as any)[dateField]+"T12:00:00").toLocaleDateString("pt-BR")
                      : <span style={{color:"var(--text-muted)"}}>___/___/______</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Botão salvar rodapé */}
      {canEdit && (
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:24}}>
          <button className="btn" onClick={()=>navigate(-1)} style={{fontSize:12}}>Cancelar</button>
          {saveBtn}
        </div>
      )}
    </div>
  );
}
