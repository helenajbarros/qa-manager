# ⚙ QA Manager — Sistema de Gestão de Testes

Sistema completo de gerenciamento de testes de QA com cadastro de casos de teste, execução por ciclos, gestão de bugs, upload de evidências, controle de usuários e dashboard com métricas em tempo real.

> **Este repositório é a versão TypeScript do projeto.** O código JavaScript original está em [helenajbarros/qa-manager](https://github.com/helenajbarros/qa-manager).

---

## 🌐 Links

| | URL |
|---|---|
| **Frontend (produção)** | https://helenajbarros.github.io/qa-manager |
| **Backend API** | https://qa-manager-api.onrender.com |
| **Health check** | https://qa-manager-api.onrender.com/api/health |

---

## 📋 Funcionalidades

### 🗃 Projetos
- Cadastro de múltiplos projetos com logo
- Todo conteúdo (módulos, casos, ciclos, bugs) isolado por projeto

### 🧩 Módulos
- Organização dos casos de teste por área funcional
- Vinculação automática de bugs pelo prefixo `[NomeDoMódulo]` no título
- Exclusão restrita a **Admin e Gerente**

### 📋 Casos de Teste
- Campos: título, descrição, pré-condições, passos, resultado esperado
- Prioridade: Baixa, Média, Alta, Crítica
- **Histórico de alterações** com data, hora e nome do usuário responsável
- Exclusão restrita a **Admin e Gerente**

### 🔁 Ciclos de Teste
- Agrupamento de casos de teste por campanha/sprint/versão
- Tipos de teste: Funcional, Regressão, Integração, Performance, Segurança, Usabilidade, Smoke, Sanidade, Exploratório, Aceitação, API, Automação
- Execução individual com status, comentário, evidências e vínculo com bug
- **Arquivamento automático:** ao arquivar um ciclo, todos os bugs vinculados às execuções são fechados automaticamente e marcados com 🔒
- Histórico completo do ciclo com linha do tempo de alterações
- Filtro agrupado por status: Ativos / Encerrados (últimos 5)
- Exclusão restrita a **Admin e Gerente**

### 🐛 Bugs
- Abas **Ativos** (Aberto + Em andamento) e **Finalizados** (Corrigido + Fechado)
- Bugs fechados por arquivamento de ciclo identificados com ícone 🔒
- Toggle para mostrar/ocultar bugs de ciclos arquivados
- Filtro de ciclos agrupado por status
- Vínculo com caso de teste e execução
- Link do tracker externo (Jira, ClickUp, etc.) e link do PR
- Link de compartilhamento público sem necessidade de login
- Histórico de atividades por bug
- Exclusão restrita a **Admin e Gerente**

### 📊 Dashboard
- Métricas em tempo real: taxa de sucesso, falha, bloqueados, não executados
- Filtro de ciclos agrupado (Ativos / Encerrados últimos 5)
- Filtros de período rápido e personalizado
- Gráficos: pizza de execuções, pizza de bugs, barras por módulo, tendência de qualidade por ciclo
- Bugs filtrados por ciclo quando ciclo está selecionado
- Exportação em Excel (.xlsx) e HTML (para salvar como PDF)

### 👥 Usuários e Permissões
- **Admin** — acesso total incluindo backup
- **Gerente** — gerencia projetos e usuários (exceto Admin). Pode excluir módulos, casos, ciclos e bugs
- **Colaborador** — executa testes, registra e edita bugs. Não pode excluir módulos, casos de teste, ciclos ou bugs
- **Visualizador** — somente leitura e exportação

### 💾 Backup e Restauração
- Download e restauração do banco via interface (apenas Admin)

---

## 🛠 Tecnologias

### Backend
| Tecnologia | Uso |
|---|---|
| **Node.js** | Runtime JavaScript |
| **Express** | Framework HTTP |
| **PostgreSQL** | Banco de dados relacional |
| **node-postgres (pg)** | Driver PostgreSQL |
| **Multer** | Upload de arquivos |
| **JWT** | Autenticação |
| **bcryptjs** | Hash de senhas |
| **TypeScript** | Tipagem estática (migração gradual) |

### Frontend
| Tecnologia | Uso |
|---|---|
| **React 18** | Interface de usuário |
| **TypeScript** | Tipagem estática |
| **Vite** | Build tool e dev server |
| **React Router v6** | Roteamento SPA |
| **Recharts** | Gráficos do dashboard |
| **SheetJS (xlsx)** | Exportação para Excel |

### Infraestrutura
| Serviço | Uso |
|---|---|
| **Render** | Hospedagem do backend (Node.js) |
| **Render PostgreSQL** | Banco de dados em produção (plano Basic $6/mês) |

---

## 🚀 Instalação local

### Pré-requisitos
- Node.js 18+
- PostgreSQL 15+ instalado localmente
- Git

### 1. Clone o repositório
```bash
git clone https://github.com/helenajbarros/qa-manager-ts.git
cd qa-manager-ts
```

### 2. Backend
```bash
cd backend
npm install
```

Crie o arquivo `.env`:
```env
PORT=3002
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/qa_manager_ts
JWT_SECRET=seu_secret
NODE_ENV=development
```

Crie o banco local:
```bash
psql -U postgres -c "CREATE DATABASE qa_manager_ts;"
```

Inicie o servidor:
```bash
node src/server.js
```

API disponível em: `http://localhost:3002`

### 3. Frontend
```bash
cd frontend
npm install
```

Crie o arquivo `.env.local`:
```env
VITE_API_URL=http://localhost:3002
```

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

App disponível em: `http://localhost:5173/qa-manager/`

---

## ⚙ Variáveis de ambiente

### Backend (`.env`)
```env
PORT=3002
DATABASE_URL=postgresql://usuario:senha@host/banco
JWT_SECRET=chave_secreta
NODE_ENV=development
```

### Frontend (`.env.local`)
```env
VITE_API_URL=http://localhost:3002
```

---

## 📁 Estrutura do projeto

```
qa-manager/
├── backend/
│   ├── src/
│   │   ├── server.js              # Entrada da aplicação
│   │   ├── types/
│   │   │   └── index.ts           # Tipos TypeScript do backend
│   │   ├── database/
│   │   │   ├── connection.js      # Conexão PostgreSQL (pool)
│   │   │   └── migrations.js      # Criação/atualização das tabelas
│   │   ├── routes/                # Endpoints HTTP
│   │   ├── controllers/           # Request/Response
│   │   ├── services/              # Lógica de negócio
│   │   ├── middlewares/           # Auth, upload, erros
│   │   └── utils/                 # Helpers de resposta
│   ├── uploads/                   # Arquivos de evidência
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Roteamento principal
│   │   ├── main.tsx               # Entrada React
│   │   ├── types/
│   │   │   └── index.ts           # Tipos TypeScript centrais
│   │   ├── context/               # AuthContext.tsx, ProjectContext.tsx
│   │   ├── pages/                 # Dashboard, Bugs, Ciclos, Módulos...
│   │   ├── components/            # Sidebar, UI, FileUpload...
│   │   ├── services/
│   │   │   ├── api.ts             # Cliente HTTP tipado
│   │   │   └── resources.ts       # Recursos da API tipados
│   │   └── hooks/
│   │       └── useAsync.ts        # Hook genérico tipado
│   ├── tsconfig.json
│   └── package.json
```

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/users/login` | Autenticação |
| GET | `/api/users/me` | Usuário logado |
| GET | `/api/users/mentions` | Lista usuários para @mentions |
| GET/POST | `/api/projects` | Projetos |
| GET/POST | `/api/modules` | Módulos |
| DELETE | `/api/modules/:id` | Excluir módulo (Admin/Gerente) |
| GET/POST | `/api/test-cases` | Casos de teste |
| DELETE | `/api/test-cases/:id` | Excluir caso de teste (Admin/Gerente) |
| GET | `/api/test-cases/:id/activity` | Histórico de alterações |
| GET/POST | `/api/cycles` | Ciclos |
| DELETE | `/api/cycles/:id` | Excluir ciclo (Admin/Gerente) |
| PUT | `/api/cycles/:id` | Editar ciclo (arquivar fecha bugs vinculados) |
| POST | `/api/cycles/:id/executions` | Adicionar casos ao ciclo |
| PUT | `/api/cycles/:id/executions/:execId` | Atualizar execução |
| GET/POST | `/api/bugs` | Bugs |
| DELETE | `/api/bugs/:id` | Excluir bug (Admin/Gerente) |
| POST | `/api/bugs/:id/files` | Upload arquivo bug |
| GET | `/api/dashboard` | Métricas |
| GET | `/api/export` | Dados para exportação Excel |
| GET | `/api/backup/download` | Download do banco |
| POST | `/api/backup/restore` | Restaurar banco |
| GET | `/api/health` | Health check |
| GET | `/api/share/:token` | Bug público sem login |

---

## 🔐 Perfis de acesso

| Perfil | Permissões |
|---|---|
| **Admin** | Tudo + gerenciar usuários, projetos e backup |
| **Gerente** | Criar, editar e excluir projetos, módulos, casos, ciclos e bugs. Gerenciar usuários (exceto Admin) |
| **Colaborador** | Executar testes, registrar e editar bugs. Não pode excluir módulos, casos de teste, ciclos ou bugs |
| **Visualizador** | Somente leitura e exportação de relatórios |

---

## 🗄 Banco de dados

O sistema usa **PostgreSQL** tanto em produção (Render) quanto localmente.

O banco local de desenvolvimento (`qa_manager_ts`) é separado do banco de produção, permitindo testar sem risco de afetar dados reais.

### Banco local
```bash
# Criar banco
psql -U postgres -c "CREATE DATABASE qa_manager_ts;"

# As migrations rodam automaticamente ao iniciar o servidor
node src/server.js
```

### Banco de produção
Hospedado no Render PostgreSQL (plano Basic). As migrations rodam automaticamente a cada deploy.

> ⚠️ O Render usa PostgreSQL 18. O pg_dump local precisa ser da mesma versão para exportar diretamente via CLI.

---

## 🔷 TypeScript

Este repositório é a evolução TypeScript do projeto. A migração foi feita de forma gradual:

**Já em TypeScript:**
- `src/types/index.ts` — todos os tipos da aplicação (User, Bug, Cycle, TestCase, etc.)
- `services/api.ts` — cliente HTTP com generics `<T>`
- `services/resources.ts` — recursos da API totalmente tipados
- `hooks/useAsync.ts` — hook genérico `useAsync<T>`
- `context/AuthContext.tsx` — contexto tipado
- `context/ProjectContext.tsx` — contexto tipado
- `main.tsx` e `App.tsx`
- Backend: `src/types/index.ts` com tipos de banco e `AuthRequest`

**Ainda em JavaScript (migração gradual):**
- `pages/*.tsx` — páginas (tipagem `any` enquanto migração avança)
- Backend `src/**/*.js`

As novas funcionalidades são desenvolvidas diretamente em TypeScript.