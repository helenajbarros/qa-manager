# ⚙ QA Manager — Sistema de Gestão de Testes

Sistema completo de gerenciamento de testes de QA com cadastro de casos de teste, execução por ciclos, gestão de bugs, upload de evidências, controle de usuários e dashboard com métricas em tempo real.

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
- **Arquivamento automático:** ao arquivar um ciclo, todos os bugs vinculados são fechados automaticamente e marcados com 🔒
- Histórico completo do ciclo com linha do tempo de alterações
- Filtro agrupado por status: Ativos / Encerrados (últimos 5)
- Exclusão restrita a **Admin e Gerente**

### 🐛 Bugs
- Abas **Ativos** (Aberto + Em andamento) e **Finalizados** (Corrigido + Fechado)
- Bugs fechados por arquivamento de ciclo identificados com ícone 🔒
- Toggle para mostrar/ocultar bugs de ciclos arquivados
- Filtro de ciclos agrupado por status
- Vínculo com caso de teste e execução
- **SO e Navegador** detectados automaticamente via `navigator.userAgent`
- **Impacto no negócio** — campo livre para descrever o efeito real do bug
- **Link de evidência** — URL externa (Drive, Loom, YouTube etc.)
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
| **Node.js** | Runtime |
| **Express** | Framework HTTP |
| **TypeScript** | Tipagem estática — 100% tipado |
| **PostgreSQL** | Banco de dados relacional |
| **node-postgres (pg)** | Driver PostgreSQL |
| **Multer** | Upload de arquivos |
| **JWT** | Autenticação |
| **bcryptjs** | Hash de senhas |
| **ts-node** | Execução TypeScript em desenvolvimento |

### Frontend

| Tecnologia | Uso |
|---|---|
| **React 18** | Interface de usuário |
| **TypeScript** | Tipagem estática — 100% tipado |
| **Vite** | Build tool e dev server |
| **React Router v6** | Roteamento SPA |
| **Recharts** | Gráficos do dashboard |
| **SheetJS (xlsx)** | Exportação para Excel |

### Infraestrutura

| Serviço | Uso |
|---|---|
| **Render** | Hospedagem do backend — build `tsc` + `node dist/server.js` |
| **Render PostgreSQL** | Banco de dados em produção |
| **GitHub Pages** | Frontend estático — deploy automático via GitHub Actions |
| **Docker / Docker Compose** | Ambiente local completo (banco + backend + frontend) com um único comando |

---

## 🚀 Instalação local

### Pré-requisitos
- Node.js 18+
- PostgreSQL instalado localmente
- Git

### 1. Clone o repositório

```bash
git clone https://github.com/helenajbarros/qa-manager.git
cd qa-manager
```

### 2. Backend

```bash
cd backend
npm install
```

Crie o arquivo `.env`:

```env
PORT=3002
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/qa_manager
JWT_SECRET=seu_secret
NODE_ENV=development
```

Crie o banco local:

```bash
psql -U postgres -c "CREATE DATABASE qa_manager;"
```

Inicie o servidor em modo desenvolvimento:

```bash
npm run dev:ts
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

## 🐳 Instalação com Docker

Alternativa ao passo a passo manual acima: sobe banco, backend e frontend juntos com um único comando.

### Pré-requisitos
- Docker e Docker Compose instalados

### Passo a passo

```bash
git clone https://github.com/helenajbarros/qa-manager.git
cd qa-manager
cp .env.docker.example .env
```

Abra o `.env` e troque `POSTGRES_PASSWORD` e `JWT_SECRET` pelos seus próprios valores. Depois:

```bash
docker compose up --build
```

| Serviço | URL |
|---|---|
| **Frontend** | http://localhost:8080 |
| **Backend API** | http://localhost:3002 |
| **PostgreSQL** (opcional, para inspecionar com pgAdmin etc.) | `localhost:5434` |

As migrations rodam automaticamente na subida do backend — não é preciso nenhum passo manual de banco.

Para parar tudo: `docker compose down` (os dados do banco e os uploads persistem entre execuções, guardados nos volumes `db_data` e `uploads_data`). Para apagar tudo, incluindo os dados: `docker compose down -v`.

> O Postgres do compose roda com `NODE_ENV=development` no backend (sem SSL), diferente da produção no Render — isso é só uma particularidade do ambiente local em Docker, não afeta o comportamento da aplicação.

---

## ⚙ Scripts disponíveis

### Backend

| Script | Descrição |
|---|---|
| `npm run dev:ts` | Desenvolvimento com ts-node (hot reload) |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda o build compilado (`dist/server.js`) |
| `npm run typecheck` | Verifica tipos sem compilar |

### Frontend

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |

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

### Docker (`.env`, a partir de `.env.docker.example`)

```env
POSTGRES_USER=qa_manager
POSTGRES_PASSWORD=troque_esta_senha
POSTGRES_DB=qa_manager
JWT_SECRET=troque_este_segredo_por_algo_aleatorio_e_unico
```

---

## 📁 Estrutura do projeto

```
qa-manager/
├── .github/
│   └── workflows/
│       └── deploy.yml             # CI/CD — build e deploy automático no GitHub Pages
│
├── docker-compose.yml             # Sobe banco + backend + frontend com um comando
├── .env.docker.example            # Modelo de variáveis para o docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── src/
│   │   ├── server.ts              # Entrada da aplicação
│   │   ├── types/
│   │   │   └── index.ts           # Tipos TypeScript do backend (AuthRequest, DbUser...)
│   │   ├── database/
│   │   │   ├── connection.ts      # Conexão PostgreSQL (pool)
│   │   │   ├── migrations.ts      # Criação/atualização das tabelas
│   │   │   └── migrations_*.ts    # Migrations incrementais por versão
│   │   ├── routes/                # Endpoints HTTP (.ts)
│   │   ├── controllers/           # Request/Response (.ts)
│   │   ├── services/              # Lógica de negócio (.ts)
│   │   ├── middlewares/           # Auth, upload, erros (.ts)
│   │   └── utils/
│   │       └── response.ts        # Helpers de resposta HTTP
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .dockerignore
│   ├── src/
│   │   ├── App.tsx                # Roteamento principal
│   │   ├── main.tsx               # Entrada React
│   │   ├── types/
│   │   │   └── index.ts           # Tipos TypeScript centrais (Bug, Cycle, User...)
│   │   ├── context/                # AuthContext.tsx, ProjectContext.tsx
│   │   ├── pages/                  # Dashboard, Bugs, BugDetail, Ciclos, Módulos...
│   │   ├── components/             # Sidebar, UI, FileUpload, ExportButton
│   │   ├── services/
│   │   │   ├── api.ts              # Cliente HTTP com generics
│   │   │   └── resources.ts        # Recursos da API tipados
│   │   └── hooks/
│   │       └── useAsync.ts         # Hook genérico useAsync<T>
│   ├── tsconfig.json
│   └── package.json
```

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/users/login` | Autenticação JWT |
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
| POST | `/api/bugs/:id/share` | Gerar link público |
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

PostgreSQL em produção (Render) e localmente. As migrations rodam automaticamente ao iniciar o servidor.

> ⚠️ O Render usa PostgreSQL 18.

---

## 🚢 Deploy

### Backend — Render
- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

### Frontend — GitHub Pages
Deploy automático via GitHub Actions a cada push na branch `main`. Não requer pasta `docs/` manual.