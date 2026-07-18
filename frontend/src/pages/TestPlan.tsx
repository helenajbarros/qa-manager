import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { testPlansApi, cyclesApi, modulesApi, bugsApi } from "../services/resources.js";
import { useProject } from "../context/ProjectContext.js";
import { Loading } from "../components/UI.js";

const fmtDate = (d: string) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";

const DEFAULT_ENTRY = `• Build disponível e estável no ambiente de teste
• Casos de teste cadastrados e revisados
• Ambiente configurado e acessível
• Equipe de QA alocada`;

const DEFAULT_EXIT = `• Taxa de sucesso ≥ 70% nos casos executados
• Nenhum bug crítico ou alto em aberto
• Cobertura mínima de 80% dos casos de teste
• Relatório de encerramento gerado`;

const DEFAULT_STRATEGY = `• Testes funcionais baseados nos casos de teste cadastrados
• Testes exploratórios nos módulos de maior risco
• Validação de bugs corrigidos em ciclos anteriores (regressão)
• Registro de evidências para bugs encontrados`;

export default function TestPlan() {
  const { id: cycleId } = useParams<{id: string}>();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const pid = currentProject?.id;

  const [cycle, setCycle] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [bugs, setBugs] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    objective: "",
    out_of_scope: "",
    entry_criteria: DEFAULT_ENTRY,
    exit_criteria: DEFAULT_EXIT,
    strategy: DEFAULT_STRATEGY,
    risks: "",
    approver_qa: "",
    approver_manager: "",
    modules_scope: [] as any[],
  });

  useEffect(() => {
    if (!cycleId) return;
    Promise.all([
      cyclesApi.get(cycleId),
      modulesApi.list(pid ? {project_id: pid} : {}),
      bugsApi.list(pid ? {project_id: pid} : {}),
      testPlansApi.get(cycleId),
    ]).then(([cycleRes, modsRes, bugsRes, planRes]: any) => {
      const c = cycleRes?.data ?? cycleRes;
      const mods = modsRes?.data ?? modsRes ?? [];
      const bugsData = bugsRes?.data ?? bugsRes ?? [];
      const p = planRes?.data ?? planRes;

      setCycle(c);
      setModules(mods);
      setBugs(bugsData);
      setPlan(p);

      // Calcular bugs por módulo para risco automático
      const bugsByMod: Record<string,number> = {};
      bugsData.forEach((b: any) => {
        if (b.module_name || b.module) {
          const mod = b.module_name || b.module;
          bugsByMod[mod] = (bugsByMod[mod]||0) + 1;
        }
      });

      // Pré-preencher módulos com justificativas automáticas
      const modulesScope = mods
        .filter((m: any) => (m.total_cases||0) > 0 || true)
        .map((m: any) => {
          const bugCount = bugsByMod[m.name] || 0;
          const risk = bugCount > 5 ? "ALTO" : bugCount > 2 ? "MÉDIO" : "BAIXO";
          const autoReason = bugCount > 5
            ? `Módulo crítico com ${bugCount} bugs históricos. Requer atenção especial.`
            : bugCount > 2
            ? `${bugCount} bugs encontrados em ciclos anteriores. Monitorar de perto.`
            : m.name.toLowerCase().includes("login") || m.name.toLowerCase().includes("auth")
            ? "Funcionalidade base do sistema. Qualquer falha impede o uso."
            : bugCount === 0
            ? "Módulo estável. Validação de regressão."
            : `${bugCount} bug(s) histórico(s). Validação necessária.`;

          return {
            id: m.id,
            name: m.name,
            total_cases: m.total_cases || 0,
            bugs: bugCount,
            risk,
            included: true,
            reason: autoReason,
          };
        });

      if (p) {
        setForm({
          objective: p.objective || "",
          out_of_scope: p.out_of_scope || "",
          entry_criteria: p.entry_criteria || DEFAULT_ENTRY,
          exit_criteria: p.exit_criteria || DEFAULT_EXIT,
          strategy: p.strategy || DEFAULT_STRATEGY,
          risks: p.risks || "",
          approver_qa: p.approver_qa || "",
          approver_manager: p.approver_manager || "",
          modules_scope: p.modules_scope || modulesScope,
        });
      } else {
        // Pré-preencher objetivo baseado no tipo do ciclo
        const types = c?.types || [];
        const objBase = types.includes("regression")
          ? `Validar que as alterações realizadas na versão ${c?.version||""} não introduziram regressões nas funcionalidades existentes do ${currentProject?.name||"sistema"}.`
          : types.includes("smoke")
          ? `Verificar as funcionalidades críticas do ${currentProject?.name||"sistema"} na versão ${c?.version||""}, garantindo estabilidade mínima para testes aprofundados.`
          : `Validar as funcionalidades do ${currentProject?.name||"sistema"} no ciclo ${c?.name||""} ${c?.version?`v${c.version}`:""}, garantindo qualidade antes da entrega.`;

        const autoRisks = modulesScope
          .filter(m => m.risk !== "BAIXO")
          .map(m => `• ${m.name}: ${m.risk} — ${m.bugCount > 5 ? "histórico elevado de bugs" : "bugs anteriores identificados"}`)
          .join("\n");

        setForm(f => ({
          ...f,
          objective: objBase,
          risks: autoRisks || "• Nenhum risco crítico identificado com base no histórico.",
          modules_scope: modulesScope,
        }));
      }
    }).finally(() => setLoading(false));
  }, [cycleId, pid]);

  async function handleSave() {
    if (!cycleId) return;
    setSaving(true);
    try {
      await testPlansApi.save(cycleId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  function updateModule(idx: number, field: string, value: any) {
    setForm(f => ({
      ...f,
      modules_scope: f.modules_scope.map((m, i) => i === idx ? {...m, [field]: value} : m)
    }));
  }

  const riskColor = (r: string) => r === "ALTO" ? "#EF4444" : r === "MÉDIO" ? "#F59E0B" : "#10B981";

  if (loading) return <Loading />;

  return (
    <div className="page" style={{maxWidth:900,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <button className="btn" onClick={()=>navigate(-1)}>← Voltar</button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20,fontWeight:700}}>📝 Plano de Teste</h1>
          <div style={{fontSize:13,color:"var(--text-muted)",marginTop:2}}>
            {cycle?.name} {cycle?.version ? `— v${cycle.version}` : ""} 
            {cycle?.start_date ? ` | ${fmtDate(cycle.start_date)} → ${cycle.end_date ? fmtDate(cycle.end_date) : "em aberto"}` : ""}
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Salvando..." : saved ? "✅ Salvo!" : "💾 Salvar"}
          </button>
        )}
      </div>

      {/* 1. Identificação */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:14,textTransform:"uppercase",letterSpacing:".05em"}}>
          1. Identificação
        </h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:13}}>
          {[
            ["Projeto", currentProject?.name||"—"],
            ["Ciclo", cycle?.name||"—"],
            ["Versão", cycle?.version ? `v${cycle.version}` : "—"],
            ["Período", cycle?.start_date ? `${fmtDate(cycle.start_date)} → ${cycle.end_date ? fmtDate(cycle.end_date) : "em aberto"}` : "—"],
            ["Tipos de Teste", (cycle?.types||[]).join(", ") || "—"],
            ["Total de Casos", `${form.modules_scope.filter(m=>m.included).reduce((a,m)=>a+m.total_cases,0)} casos`],
          ].map(([label, value]) => (
            <div key={label} style={{padding:"10px 14px",background:"var(--bg)",borderRadius:8,border:"1px solid var(--border)"}}>
              <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{label}</div>
              <div style={{fontWeight:500}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Objetivo */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em"}}>
          2. Objetivo
        </h2>
        {canEdit ? (
          <textarea value={form.objective} onChange={e=>setForm(f=>({...f,objective:e.target.value}))}
            rows={3} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",
              fontSize:13,fontFamily:"inherit",resize:"vertical"}} />
        ) : <p style={{fontSize:13,lineHeight:1.7}}>{form.objective||"—"}</p>}
      </div>

      {/* 3. Escopo */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em"}}>
          3. Escopo dos Testes
        </h2>
        <p style={{fontSize:12,color:"var(--text-muted)",marginBottom:12}}>
          Marque os módulos que serão testados e edite a justificativa se necessário.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {form.modules_scope.map((m, idx) => (
            <div key={m.id} style={{border:"1px solid var(--border)",borderRadius:8,padding:"12px 14px",
              background:m.included?"var(--card)":"var(--bg)",opacity:m.included?1:0.6}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:m.included?8:0}}>
                {canEdit && (
                  <input type="checkbox" checked={m.included} onChange={e=>updateModule(idx,"included",e.target.checked)}
                    style={{width:16,height:16,cursor:"pointer"}} />
                )}
                <span style={{fontWeight:600,fontSize:13}}>{m.name}</span>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>{m.total_cases} casos</span>
                <span style={{fontSize:11,color:"var(--text-muted)"}}>{m.bugs} bug(s) histórico(s)</span>
                <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,
                  background:riskColor(m.risk)+"20",color:riskColor(m.risk)}}>
                  {m.risk}
                </span>
              </div>
              {m.included && (
                <div style={{paddingLeft:canEdit?26:0}}>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:4}}>Por que será testado:</div>
                  {canEdit ? (
                    <input value={m.reason} onChange={e=>updateModule(idx,"reason",e.target.value)}
                      style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12,fontFamily:"inherit"}} />
                  ) : <p style={{fontSize:12,color:"var(--text)"}}>{m.reason}</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div style={{marginTop:16}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>O que NÃO será testado:</div>
            <textarea value={form.out_of_scope} onChange={e=>setForm(f=>({...f,out_of_scope:e.target.value}))}
              placeholder="Ex: Testes de performance, integrações externas, módulo X (fora do escopo da versão)..."
              rows={2} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",
                fontSize:13,fontFamily:"inherit",resize:"vertical"}} />
          </div>
        )}
      </div>

      {/* 4. Critérios de Entrada */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em"}}>
          4. Critérios de Entrada
        </h2>
        {canEdit ? (
          <textarea value={form.entry_criteria} onChange={e=>setForm(f=>({...f,entry_criteria:e.target.value}))}
            rows={5} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",
              fontSize:13,fontFamily:"inherit",resize:"vertical"}} />
        ) : <pre style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{form.entry_criteria}</pre>}
      </div>

      {/* 5. Critérios de Saída */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em"}}>
          5. Critérios de Saída (Quality Gate)
        </h2>
        {canEdit ? (
          <textarea value={form.exit_criteria} onChange={e=>setForm(f=>({...f,exit_criteria:e.target.value}))}
            rows={5} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",
              fontSize:13,fontFamily:"inherit",resize:"vertical"}} />
        ) : <pre style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{form.exit_criteria}</pre>}
      </div>

      {/* 6. Estratégia */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em"}}>
          6. Estratégia de Teste
        </h2>
        {canEdit ? (
          <textarea value={form.strategy} onChange={e=>setForm(f=>({...f,strategy:e.target.value}))}
            rows={5} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",
              fontSize:13,fontFamily:"inherit",resize:"vertical"}} />
        ) : <pre style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{form.strategy}</pre>}
      </div>

      {/* 7. Riscos */}
      <div className="card" style={{marginBottom:16,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:12,textTransform:"uppercase",letterSpacing:".05em"}}>
          7. Riscos
        </h2>
        {canEdit ? (
          <textarea value={form.risks} onChange={e=>setForm(f=>({...f,risks:e.target.value}))}
            rows={5} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",
              fontSize:13,fontFamily:"inherit",resize:"vertical"}} />
        ) : <pre style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{form.risks}</pre>}
      </div>

      {/* 8. Aprovação */}
      <div className="card" style={{marginBottom:24,padding:"18px 20px"}}>
        <h2 style={{fontSize:14,fontWeight:700,color:"var(--accent)",marginBottom:14,textTransform:"uppercase",letterSpacing:".05em"}}>
          8. Aprovação
        </h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {[
            ["Elaborado por (QA)", "approver_qa", "Nome do QA responsável"],
            ["Aprovado por (Gestor)", "approver_manager", "Nome do gestor/cliente"],
          ].map(([label, field, placeholder]) => (
            <div key={field} style={{border:"1px solid var(--border)",borderRadius:8,padding:"14px 16px"}}>
              <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",marginBottom:8}}>{label}</div>
              {canEdit ? (
                <input value={(form as any)[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                  placeholder={placeholder as string}
                  style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}} />
              ) : (
                <div style={{borderBottom:"1px solid var(--text)",paddingBottom:4,marginTop:24,fontSize:12,color:"var(--text-muted)"}}>
                  {(form as any)[field] || "___________________________"}
                </div>
              )}
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:8}}>Data: ___/___/______</div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão salvar bottom */}
      {canEdit && (
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:32}}>
          <button className="btn" onClick={()=>navigate(-1)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Salvando..." : saved ? "✅ Salvo!" : "💾 Salvar Plano"}
          </button>
        </div>
      )}
    </div>
  );
}
