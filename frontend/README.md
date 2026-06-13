# ⚙ QA Manager — Sistema de Gestão de Testes

Sistema completo de gerenciamento de testes de QA com cadastro de casos de teste, execução por ciclos, gestão de bugs, upload de evidências, controle de usuários e dashboard com métricas em tempo real.

---

## 🌐 Links

| | URL |
|---|---|
| **Frontend** | https://helenajbarros.github.io/qa-manager |
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

### 📋 Casos de Teste
- Campos: título, descrição, pré-condições, passos, resultado esperado
- Prioridade: Baixa, Média, Alta, Crítica
- Histórico de alterações com data, hora e usuário

### 🔁 Ciclos de Teste
- Agrupamento de casos de teste por campanha/sprint/versão
- Tipos de teste: Funcional, Regressão, Integração, Performance, Segurança, Usabilidade, Smoke, Sanidade, Exploratório, Aceitação, API, Automação
- Execução individual com status, comentário, evidências e vínculo com bug
- **Arquivamento automático:** ao arquivar um ciclo, todos os bugs vinculados às execuções são fechados automaticamente e marcados com 🔒
- Histórico completo do ciclo com linha do tempo de alterações
- Filtro agrupado por status: Ativos / Encerrados (últimos 5)

### 🐛 Bugs
- Abas **Ativos** (Aberto + Em andamento) e **Finalizados** (Corrigido + Fechado)
- Bugs fechados por arquivamento de ciclo identificados com ícone 🔒
- Toggle para mostrar/ocultar bugs de ciclos arquivados
- Filtro de ciclos agrupado por status
- Vínculo com caso de teste e execução
- Link do tracker externo (Jira, ClickUp, etc.) e link do PR
- Link de compartilhamento público sem necessidade de login
- Histórico de atividades por bug

### 📊 Dashboard
- Métricas em tempo real: taxa de sucesso, falha, bloqueados, não executados
- Filtro de ciclos agrupado (Ativos / Encerrados últimos 5)
- Filtros de período rápido e personalizado
- Gráficos: pizza de execuções, pizza de bugs, barras por módulo, tendência de qualidade por ciclo
- Bugs filtrados por ciclo quando ciclo está selecionado
- Exportação em Excel (.xlsx) e HTML (para salvar como PDF)

### 👥 Usuários e Permissões
- **Admin** — acesso total incluindo backup
- **Gerente** — gerencia projetos e usuários (exceto Admin)
- **Colaborador** — executa testes e registra bugs
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

### Frontend
| Tecnologia | Uso |
|---|---|
| **React 18** | Interface de usuário |
| **Vite** | Build tool e dev server |
| **React Router v6** | Roteamento SPA |
| **Recharts** | Gráficos do dashboard |
| **SheetJS (xlsx)** | Exportação para Excel |

### Infraestrutura
| Serviço | Uso |
|---|---|
| **Render** | Hospedagem do backend (Node.js) |
| **Render PostgreSQL** | Banco de dados em produção (plano Basic $6/mês) |
| **GitHub Pages** | Hospedagem do frontend (estático via pasta `docs/`) |
| **GitHub Actions** | CI/CD — build e deploy automático do frontend |

---

## 🚀 Instalação local

### Pré-requisitos
- Node.js 18+
- PostgreSQL 15+ instalado localmente
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
PORT=3001
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/qa_manager
JWT_SECRET=seu_secret
FRONTEND_URL=http://localhost:5173
QA_UPLOAD_DIR=uploads
```

Crie o banco local:
```bash
psql -U postgres -c "CREATE DATABASE qa_manager;"
```

Inicie o servidor:
```bash
npm run dev
```

API disponível em: `http://localhost:3001`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

App disponível em: `http://localhost:5173`

> O frontend já está configurado para usar o backend em `localhost:3001` via proxy do Vite.

---

## ⚙ Variáveis de ambiente

### Backend (`.env`)
```env
PORT=3001
DATABASE_URL=postgresql://usuario:senha@host/banco
JWT_SECRET=chave_secreta
FRONTEND_URL=http://localhost:5173
QA_UPLOAD_DIR=uploads
```

### Produção (Render — Environment Variables)
```env
DATABASE_URL=postgresql://qamanager:senha@host.render.com/qamanager
JWT_SECRET=chave_secreta
FRONTEND_URL=https://helenajbarros.github.io
NODE_ENV=production
```

---

## 📁 Estrutura do projeto

```
qa-manager/
├── backend/
│   ├── src/
│   │   ├── index.js               # Entrada da aplicação
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
│   │   ├── App.jsx                # Roteamento principal
│   │   ├── main.jsx               # Entrada React
│   │   ├── context/               # AuthContext, ProjectContext
│   │   ├── pages/                 # Dashboard, Bugs, Ciclos, Módulos...
│   │   ├── components/            # Sidebar, UI, FileUpload...
│   │   ├── services/              # Chamadas à API
│   │   └── hooks/                 # useAsync
│   └── package.json
│
├── docs/                          # Build do frontend (GitHub Pages)
└── .github/workflows/deploy.yml   # CI/CD GitHub Actions
```

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/users/login` | Autenticação |
| GET | `/api/users/me` | Usuário logado |
| GET/POST | `/api/projects` | Projetos |
| GET/POST | `/api/modules` | Módulos |
| GET/POST | `/api/test-cases` | Casos de teste |
| GET/POST | `/api/cycles` | Ciclos |
| PUT | `/api/cycles/:id` | Editar ciclo (arquivar fecha bugs vinculados) |
| POST | `/api/cycles/:id/executions` | Adicionar casos ao ciclo |
| PUT | `/api/cycles/:id/executions/:execId` | Atualizar execução |
| POST | `/api/cycles/:id/executions/:execId/evidence` | Upload evidência |
| GET/POST | `/api/bugs` | Bugs (retorna `cycle_status` e `closed_by_archive`) |
| POST | `/api/bugs/:id/files` | Upload arquivo bug |
| GET | `/api/dashboard` | Métricas |
| GET | `/api/export` | Dados para exportação Excel |
| GET | `/api/backup/download` | Download do banco |
| POST | `/api/backup/restore` | Restaurar banco |
| GET | `/api/health` | Health check |
| GET | `/api/share/:token` | Bug público sem login |

---

## 📦 Deploy

### Backend — Render (Web Service)
1. Conecte o repositório no [render.com](https://render.com)
2. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
3. Adicione as variáveis de ambiente no painel
4. O banco PostgreSQL está no mesmo workspace do Render — use a **Internal Database URL** para menor latência

### Frontend — GitHub Pages
O deploy é automático via GitHub Actions a cada push na `main`.

Para deploy manual:
```bash
npm run build --prefix frontend
Remove-Item -Recurse -Force docs   # Windows PowerShell
mkdir docs
xcopy frontend\dist\* docs\ /E /I /Y
git add .
git commit -m "deploy: build frontend"
git push origin main
```

---

## 🔐 Perfis de acesso

| Perfil | Permissões |
|---|---|
| **Admin** | Tudo + gerenciar usuários, projetos e backup |
| **Gerente** | Criar e editar projetos, módulos, casos, ciclos e bugs. Gerenciar usuários (exceto Admin) |
| **Colaborador** | Executar testes e registrar bugs nos projetos atribuídos |
| **Visualizador** | Somente leitura e exportação de relatórios |

---

## 🗄 Banco de dados

O sistema usa **PostgreSQL** tanto em produção (Render) quanto localmente.

### Backup via sistema
1. Acesse como **Admin** → menu **Backup**
2. Clique em **Download do backup** para exportar
3. Clique em **Restaurar backup** para importar

### Backup via linha de comando (local → Render)
```bash
# Exportar do Render (requer pg_dump compatível com PostgreSQL 18)
# Usar a opção Export no painel Render → Recovery → Create export

# Restaurar localmente
psql -U postgres -d qa_manager -f backup.sql
```

> ⚠️ O Render usa PostgreSQL 18. O pg_dump local precisa ser da mesma versão para exportar diretamente via CLI.