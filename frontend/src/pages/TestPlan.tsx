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
    modules_scope: [] as any[],
  });

  const set = (k: string) => (v: any) => setForm(f => ({...f, [k]: v}));

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
          modules_scope: p.modules_scope||modulesScope,
        });
      } else {
        const types = c?.types || [];
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
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  function updMod(idx: number, field: string, value: any) {
    setForm(f => ({...f, modules_scope: f.modules_scope.map((m,i) => i===idx ? {...m,[field]:value} : m)}));
  }

  if (loading) return <Loading />;

  const totalCases = form.modules_scope.filter(m=>m.included).reduce((a,m)=>a+m.total_cases,0);
  const saveBtn = (
    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{minWidth:90}}>
      {saving ? "⏳ Salvando..." : saved ? "✅ Salvo!" : "💾 Salvar"}
    </button>
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
          <Field label="Tipos de Teste">{(cycle?.types||[]).join(", ") || "—"}</Field>
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
            ["Elaborado por (QA)", "approver_qa", "Nome do QA responsável"],
            ["Aprovado por (Gestor)", "approver_manager", "Nome do gestor/cliente"],
          ].map(([label, field, placeholder]) => (
            <div key={field} style={{border:"1px solid var(--border)",borderRadius:6,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--text-muted)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{label}</div>
              {canEdit ? (
                <input value={(form as any)[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                  placeholder={placeholder as string}
                  style={{width:"100%",padding:"5px 8px",borderRadius:4,border:"1px solid var(--border)",fontSize:12}} />
              ) : (
                <div style={{fontSize:12,fontWeight:500,minHeight:20}}>
                  {(form as any)[field] || <span style={{color:"var(--text-muted)"}}>Não preenchido</span>}
                </div>
              )}
              <div style={{borderTop:"1px solid var(--border)",marginTop:16,paddingTop:4,
                fontSize:10,color:"var(--text-muted)"}}>
                Assinatura / Data: ___/___/______
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
