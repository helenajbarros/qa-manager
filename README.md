# 📋 QA Manager — Sistema de Gestão de Testes

Sistema completo de gerenciamento de testes de QA com dashboard de métricas, gestão de ciclos, casos de teste, bugs, plano de teste, relatórios executivos e controle de acesso por projeto.

---

## 🚀 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + TypeScript + Express |
| Banco | PostgreSQL (Render) |
| Deploy Frontend | GitHub Pages |
| Deploy Backend | Render (Basic $6/mês) |

---

## 🌐 URLs

- **Frontend:** https://helenajbarros.github.io/qa-manager/
- **Backend:** https://qa-manager-api.onrender.com
- **Banco:** PostgreSQL no Render

---

## 📁 Estrutura

```
qa-manager/
├── frontend/          # React + TypeScript
│   ├── src/
│   │   ├── pages/     # Dashboard, Bugs, Cycles, TestPlan, etc.
│   │   ├── components/# UI, ExportButton, FileUpload
│   │   ├── context/   # AuthContext, ProjectContext
│   │   ├── services/  # resources.ts (APIs)
│   │   └── hooks/     # useAsync
│   └── vite.config.ts
└── backend/           # Node + TypeScript
    └── src/
        ├── controllers/
        ├── services/
        ├── routes/
        ├── middlewares/
        └── database/
```

---

## ⚙️ Instalação local

### Backend
```bash
cd backend
npm install
npm run dev:ts
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🗃️ Banco de Dados

Principais tabelas:

| Tabela | Descrição |
|--------|-----------|
| `projects` | Projetos de QA |
| `project_environments` | Ambientes customizáveis por projeto |
| `modules` | Módulos de cada projeto |
| `test_cases` | Casos de teste |
| `test_cycles` | Ciclos de teste |
| `test_executions` | Execuções dos casos |
| `test_plans` | Planos de teste por ciclo |
| `bugs` | Bugs com environment_id e version |
| `users` | Usuários com controle de acesso |
| `user_projects` | Vínculo usuário ↔ projeto |
| `evidence_files` | Arquivos de evidência |

---

## 👥 Perfis de Acesso

| Perfil | Permissões |
|--------|-----------|
| Admin | Acesso total incluindo backup |
| Gerente | Tudo exceto backup, cria usuários |
| Colaborador | Cria e edita nos projetos vinculados |
| Visualizador | Somente leitura |

> Usuários sem projeto vinculado não têm acesso a nenhuma funcionalidade.

---

## 📊 Funcionalidades

### Dashboard
- Métricas por ciclo ativo (sucesso, falha, bloqueados)
- Filtros por período, ciclo, módulo e versão
- Gráfico de bugs por ambiente (customizável)
- Histórico por versão com tooltip nos ciclos

### Casos de Teste
- CRUD com módulo, prioridade, passos e resultado esperado
- Paginação com seletor (10/25/50/Todos)
- Exportar em Excel e HTML+PDF

### Ciclos de Teste
- Execução por caso de teste com status
- Upload de evidências
- Indicador visual de Plano de Teste criado/pendente
- Tooltip com métricas por versão

### Plano de Teste
- Criado antes do ciclo de testes
- Pré-preenchido automaticamente com dados do projeto
- Risco por módulo calculado pelo histórico de bugs
- Pré-preenche com ciclo anterior quando existe
- Exportar como PDF
- Permissão: Admin/Gerente editam, demais visualizam

### Bugs
- Ambiente customizável por projeto (environment_id)
- Campo versão para rastreio
- Filtro por ciclo, sem vínculo com ciclo (exploratórios)
- Link público compartilhável

### Ambientes
- Configurados por projeto (nome e cor customizados)
- Usados nos bugs e no gráfico do dashboard

### Exportação
| Relatório | Público |
|-----------|---------|
| Excel (.xlsx) | Dados |
| Relatório Técnico (HTML) | Time de QA |
| Relatório de Defeitos | Time de QA |
| Plano de Teste | Time de QA |
| Quality Gate Report | Gestão/Cliente |
| Release Notes de QA | Gestão/Cliente |

---

## 🚢 Deploy

### Frontend (GitHub Pages)
```bash
git push origin main
# GitHub Actions faz o build e deploy automaticamente
```

### Backend (Render)
- Deploy automático ao push no `main`
- Build: `npm install && npm run build`
- Start: `npm start`

---

## 📄 Documentação

- `QA_Manager_Manual_Usuario_v1_7_0.docx` — Manual do usuário
- `QA_Manager_Documentacao_v1_7_0.docx` — Documentação técnica

---

## 📌 Versão atual: v1.7.0

### Changelog v1.7.0
- ✅ Plano de Teste por ciclo com pré-preenchimento automático
- ✅ Ambientes customizáveis por projeto
- ✅ Gráfico de bugs por ambiente no dashboard
- ✅ 4 tipos de relatório (Técnico, Defeitos, Quality Gate, Release Notes)
- ✅ Histórico por versão com tooltip nos ciclos
- ✅ Campo versão nos bugs
- ✅ Filtro "Bugs sem vínculo com ciclo"
- ✅ Seletor de itens por página (10/25/50/Todos)
- ✅ Controle de acesso por projeto (usuário sem projeto bloqueado)
- ✅ Indicador visual de plano e projetos vinculados
