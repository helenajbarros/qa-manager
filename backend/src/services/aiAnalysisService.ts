import { query } from "../database/connection";

export async function analyzeTestCases(project_id: number) {
  // 1. Buscar módulos com contagem de casos e bugs
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

  // 2. Buscar títulos dos casos por módulo para analisar cobertura
  const testCases = await query<any>(`
    SELECT tc.title, tc.module_id, m.name AS module_name, tc.priority
    FROM test_cases tc
    LEFT JOIN modules m ON m.id = tc.module_id
    WHERE m.project_id = $1
  `, [project_id]);

  // 3. Buscar casos nunca executados
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

  // 4. Buscar casos que sempre falham
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

  // 5. Buscar bugs por módulo para entender problemas recorrentes
  const bugsByModule = await query<any>(`
    SELECT m.name AS module_name, b.title AS bug_title, b.severity
    FROM bugs b
    LEFT JOIN modules m ON m.id = b.module_id
    WHERE m.project_id = $1
    ORDER BY m.name, b.severity DESC
  `, [project_id]);

  // Analisar cobertura por módulo
  const CENARIOS_COMUNS = [
    { keywords: ['login', 'senha', 'acesso', 'autenti'], tipo: 'autenticação', sugestoes: ['login com credenciais inválidas', 'bloqueio após múltiplas tentativas', 'recuperação de senha', 'sessão expirada'] },
    { keywords: ['cadastr', 'criar', 'novo', 'adicionar', 'insert'], tipo: 'cadastro', sugestoes: ['campos obrigatórios em branco', 'dados inválidos', 'duplicidade de registro', 'limite de caracteres'] },
    { keywords: ['editar', 'atualizar', 'alterar', 'update'], tipo: 'edição', sugestoes: ['editar sem permissão', 'salvar com campos inválidos', 'cancelar edição', 'concorrência de edição'] },
    { keywords: ['excluir', 'deletar', 'remover', 'delete'], tipo: 'exclusão', sugestoes: ['excluir sem permissão', 'excluir item vinculado', 'confirmação de exclusão', 'recuperação após exclusão'] },
    { keywords: ['upload', 'arquivo', 'documento', 'anexo', 'file'], tipo: 'upload', sugestoes: ['arquivo com formato inválido', 'arquivo acima do tamanho limite', 'upload sem permissão', 'arquivo corrompido', 'múltiplos uploads simultâneos'] },
    { keywords: ['download', 'exportar', 'gerar', 'relatório', 'pdf'], tipo: 'exportação', sugestoes: ['exportar sem dados', 'exportar com filtros aplicados', 'formato de arquivo inválido'] },
    { keywords: ['buscar', 'filtrar', 'pesquisar', 'listar', 'search'], tipo: 'busca', sugestoes: ['busca sem resultados', 'busca com caracteres especiais', 'filtros combinados', 'paginação'] },
    { keywords: ['permiss', 'acesso', 'perfil', 'papel', 'role'], tipo: 'permissão', sugestoes: ['acesso negado para perfil restrito', 'ação de admin por usuário comum', 'troca de perfil', 'acesso sem login'] },
    { keywords: ['status', 'aprovação', 'rejeitar', 'aprovar', 'fluxo'], tipo: 'fluxo de status', sugestoes: ['transição de status inválida', 'aprovação sem permissão', 'rejeição com justificativa obrigatória', 'notificação de mudança de status'] },
    { keywords: ['prazo', 'data', 'vencimento', 'deadline'], tipo: 'datas', sugestoes: ['data retroativa', 'prazo expirado', 'data inválida', 'fuso horário'] },
  ];

  // Gerar sugestões específicas por módulo
  const suggestions: string[] = [];

  (modules as any[]).forEach((mod: any) => {
    const modCases = (testCases as any[])
      .filter((tc: any) => tc.module_id === mod.id)
      .map((tc: any) => tc.title.toLowerCase());

    const modBugs = (bugsByModule as any[])
      .filter((b: any) => b.module_name === mod.name)
      .map((b: any) => b.bug_title?.toLowerCase() || '');

    // Sinônimos para melhorar detecção
    const SINONIMOS: Record<string, string[]> = {
      'inválido': ['invalido', 'incorreto', 'erro', 'errado', 'invalid'],
      'limite':   ['maximo', 'máximo', 'tamanho', 'length', 'max', 'exceder'],
      'permissão': ['permissao', 'acesso', 'negado', 'proibido', 'restrito', 'autoriza'],
      'obrigatório': ['obrigatorio', 'required', 'vazio', 'branco', 'em branco'],
      'upload':   ['envio', 'arquivo', 'anexo', 'file', 'documento'],
      'excluir':  ['deletar', 'remover', 'apagar', 'delete'],
      'editar':   ['alterar', 'atualizar', 'modificar', 'update'],
      'busca':    ['pesquisa', 'filtro', 'search', 'procurar'],
      'expirado': ['vencido', 'expirou', 'prazo', 'timeout'],
      'duplica':  ['duplicado', 'repetido', 'ja existe', 'já existe'],
      'cancelar': ['cancelamento', 'desistir', 'voltar'],
      'bloqueio': ['bloquear', 'bloquear', 'tentativas', 'bloqueado'],
      'corrompido': ['corrompido', 'danificado', 'invalido', 'quebrado'],
    };

    function expandirSinonimos(palavra: string): string[] {
      const resultado = [palavra.toLowerCase()];
      Object.entries(SINONIMOS).forEach(([base, sinonimos]) => {
        if (palavra.toLowerCase().includes(base)) {
          resultado.push(...sinonimos);
        }
        sinonimos.forEach(sin => {
          if (palavra.toLowerCase().includes(sin)) {
            resultado.push(base, ...sinonimos);
          }
        });
      });
      return [...new Set(resultado)];
    }

    // Para cada tipo de cenário, verificar se já está coberto
    CENARIOS_COMUNS.forEach(cenario => {
      const temCenario = modCases.some(title =>
        cenario.keywords.some(kw => title.includes(kw))
      );

      if (temCenario) {
        cenario.sugestoes.forEach(sug => {
          const palavrasSug = sug.split(' ').filter(w => w.length > 3);
          const todasPalavras = palavrasSug.flatMap(p => expandirSinonimos(p));

          const jaTemSugestao = modCases.some(title =>
            todasPalavras.some(w => title.includes(w))
          );
          if (!jaTemSugestao) {
            suggestions.push(`**${mod.name}** — Adicionar caso para: ${sug}`);
          }
        });
      }
    });

    // Sugestões baseadas em bugs históricos
    if (Number(mod.total_bugs) > 2) {
      modBugs.slice(0, 2).forEach((bugTitle: string) => {
        if (bugTitle) {
          suggestions.push(`**${mod.name}** — Criar caso de regressão para bug conhecido: "${bugTitle.substring(0, 60)}${bugTitle.length > 60 ? '...' : ''}"`);
        }
      });
    }
  });

  // Sugestões gerais só se houver módulos e casos cadastrados
  const totalCasesGlobal = (modules as any[]).reduce((a: number, m: any) => a + Number(m.total_cases), 0);
  if (suggestions.length === 0 && totalCasesGlobal > 0) {
    suggestions.push("Adicionar casos de teste para fluxos de erro em todos os módulos");
    suggestions.push("Criar casos de teste para diferentes perfis de usuário (Admin, Gerente, Colaborador, Visualizador)");
    suggestions.push("Adicionar casos de teste para validação de campos obrigatórios");
  }

  // Limitar sugestões para não ficar longo demais
  const topSuggestions = suggestions.slice(0, 10);

  // Gaps
  const gaps: string[] = [];
  const lowCoverage = (modules as any[]).filter((m: any) => Number(m.total_cases) > 0 && Number(m.total_cases) < 5);
  const criticalModules = (modules as any[]).filter((m: any) =>
    ['login', 'auth', 'acesso', 'usuario', 'usuário', 'permiss'].some(k =>
      m.name.toLowerCase().includes(k)
    )
  );

  lowCoverage.forEach((m: any) => {
    gaps.push(`Módulo **${m.name}** tem apenas ${m.total_cases} caso(s) de teste — pode estar subrepresentado`);
  });
  criticalModules.forEach((m: any) => {
    if (Number(m.total_cases) < 5) {
      gaps.push(`Módulo **${m.name}** é crítico mas tem apenas ${m.total_cases} caso(s) — recomenda-se ampliar a cobertura`);
    }
  });
  if (neverExecuted.length > 0) {
    gaps.push(`${neverExecuted.length} caso(s) de teste **nunca foram executados** em nenhum ciclo`);
  }

  // Alta prioridade
  const highPriority = (modules as any[])
    .filter((m: any) => Number(m.total_bugs) > 0)
    .slice(0, 5)
    .map((m: any) => ({
      module: m.name,
      cases: Number(m.total_cases),
      bugs: Number(m.total_bugs),
      open_bugs: Number(m.open_bugs),
      reason: Number(m.open_bugs) > 0
        ? `${m.total_bugs} bugs históricos (${m.open_bugs} em aberto)`
        : `${m.total_bugs} bugs históricos`
    }));

  return {
    summary: {
      total_modules: modules.length,
      total_cases: (modules as any[]).reduce((a: number, m: any) => a + Number(m.total_cases), 0),
      total_bugs: (modules as any[]).reduce((a: number, m: any) => a + Number(m.total_bugs), 0),
      never_executed: neverExecuted.length,
    },
    high_priority: highPriority,
    always_fail: (alwaysFail as any[]).map((tc: any) => ({
      id: tc.id,
      title: tc.title,
      module: tc.module_name,
      executions: Number(tc.executions),
    })),
    never_executed: (neverExecuted as any[]).map((tc: any) => ({
      id: tc.id,
      title: tc.title,
      module: tc.module_name,
    })),
    gaps,
    suggestions: topSuggestions,
    modules: (modules as any[]).map((m: any) => ({
      name: m.name,
      total_cases: Number(m.total_cases),
      total_bugs: Number(m.total_bugs),
      open_bugs: Number(m.open_bugs),
    })),
  };
}