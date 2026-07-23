import { query } from "../database/connection";

export async function analyzeTestCases(project_id: number) {
  // 1. Buscar módulos com contagem de casos
  const modules = await query<any>(`
    SELECT m.id, m.name,
      COUNT(DISTINCT tc.id) AS total_cases,
      COUNT(DISTINCT b.id) AS total_bugs,
      COUNT(DISTINCT CASE WHEN b.status = 'open' THEN b.id END) AS open_bugs
    FROM modules m
    LEFT JOIN test_cases tc ON tc.module_id = m.id
    LEFT JOIN bugs b ON b.module_id = m.id
    WHERE m.project_id = $1
    GROUP BY m.id, m.name
    ORDER BY total_bugs DESC, total_cases ASC
  `, [project_id]);

  // 2. Buscar casos nunca executados
  const neverExecuted = await query<any>(`
    SELECT tc.id, tc.title, m.name AS module_name
    FROM test_cases tc
    LEFT JOIN modules m ON m.id = tc.module_id
    WHERE tc.module_id IN (SELECT id FROM modules WHERE project_id = $1)
    AND tc.id NOT IN (
      SELECT DISTINCT e.test_case_id FROM test_executions e
      WHERE e.test_case_id IS NOT NULL
    )
    LIMIT 10
  `, [project_id]);

  // 3. Buscar casos que sempre falham
  const alwaysFail = await query<any>(`
    SELECT tc.id, tc.title, m.name AS module_name,
      COUNT(e.id) AS executions,
      SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) AS failures
    FROM test_cases tc
    JOIN test_executions e ON e.test_case_id = tc.id
    LEFT JOIN modules m ON m.id = tc.module_id
    WHERE tc.module_id IN (SELECT id FROM modules WHERE project_id = $1)
    GROUP BY tc.id, tc.title, m.name
    HAVING COUNT(e.id) >= 2 AND SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) = COUNT(e.id)
    LIMIT 5
  `, [project_id]);

  // 4. Buscar módulos com baixa cobertura
  const lowCoverage = modules.filter((m: any) => {
    const total = Number(m.total_cases);
    return total > 0 && total < 5;
  });

  // 5. Módulos críticos (login, auth, acesso)
  const criticalModules = modules.filter((m: any) =>
    ['login', 'auth', 'acesso', 'usuario', 'usuário', 'permiss'].some(k =>
      m.name.toLowerCase().includes(k)
    )
  );

  // Montar análise
  const highPriority = modules
    .filter((m: any) => Number(m.total_bugs) > 0)
    .slice(0, 5);

  const gaps: string[] = [];

  // Gap: módulos com poucos casos
  lowCoverage.forEach((m: any) => {
    gaps.push(`Módulo **${m.name}** tem apenas ${m.total_cases} caso(s) de teste — pode estar subrepresentado`);
  });

  // Gap: módulos críticos com pouca cobertura
  criticalModules.forEach((m: any) => {
    if (Number(m.total_cases) < 5) {
      gaps.push(`Módulo **${m.name}** é crítico mas tem apenas ${m.total_cases} caso(s) — recomenda-se ampliar a cobertura`);
    }
  });

  // Gap: casos nunca executados
  if (neverExecuted.length > 0) {
    gaps.push(`${neverExecuted.length} caso(s) de teste **nunca foram executados** em nenhum ciclo`);
  }

  // Sugestões
  const suggestions: string[] = [];
  modules.forEach((m: any) => {
    if (Number(m.total_bugs) > 3) {
      suggestions.push(`Adicionar casos de **regressão** no módulo ${m.name} (histórico de ${m.total_bugs} bugs)`);
    }
  });
  suggestions.push("Criar casos de teste para **fluxos de erro** (campos inválidos, permissões negadas, dados ausentes)");
  suggestions.push("Adicionar casos de teste para **diferentes perfis de usuário** (Admin, Gerente, Colaborador, Visualizador)");

  return {
    summary: {
      total_modules: modules.length,
      total_cases: modules.reduce((a: number, m: any) => a + Number(m.total_cases), 0),
      total_bugs: modules.reduce((a: number, m: any) => a + Number(m.total_bugs), 0),
      never_executed: neverExecuted.length,
    },
    high_priority: highPriority.map((m: any) => ({
      module: m.name,
      cases: Number(m.total_cases),
      bugs: Number(m.total_bugs),
      open_bugs: Number(m.open_bugs),
      reason: Number(m.open_bugs) > 0
        ? `${m.total_bugs} bugs históricos (${m.open_bugs} em aberto)`
        : `${m.total_bugs} bugs históricos`
    })),
    always_fail: alwaysFail.map((tc: any) => ({
      id: tc.id,
      title: tc.title,
      module: tc.module_name,
      executions: Number(tc.executions),
    })),
    never_executed: neverExecuted.map((tc: any) => ({
      id: tc.id,
      title: tc.title,
      module: tc.module_name,
    })),
    gaps,
    suggestions,
    modules: modules.map((m: any) => ({
      name: m.name,
      total_cases: Number(m.total_cases),
      total_bugs: Number(m.total_bugs),
      open_bugs: Number(m.open_bugs),
    })),
  };
}