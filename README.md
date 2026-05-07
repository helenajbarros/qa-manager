# ⚙ QA Manager — Sistema de Gestão de Testes

Sistema completo de gerenciamento de testes de QA com cadastro de casos de teste, execução por ciclos, gestão de bugs, upload de evidências, controle de usuários e dashboard com métricas.

---
Sistema online - https://helenajbarros.github.io/qa-manager
## 🌐 Demo

| | URL |
|---|---|
| **Frontend** | https://cool-taffy-ae3711.netlify.app |
| **Backend API** | https://qa-manager-api.onrender.com |
| **Health check** | https://qa-manager-api.onrender.com/api/health |

**Login padrão:**
```
Email: admin@qa.com
Senha: admin123
```

> ⚠️ O backend usa o plano gratuito do Render — pode demorar ~30s para responder após um período de inatividade.

---

## 📋 Funcionalidades

### 🗃 Projetos
- Cadastro de múltiplos projetos
- Upload de logo por projeto
- Dashboard filtrado por projeto

### 🗂 Módulos
- Organização dos casos de teste por módulo
- Vinculado ao projeto selecionado

### 📋 Casos de Teste
- ID numérico sequencial
- Campos: título, descrição, pré-condições, passos, resultado esperado
- Prioridade: Baixa, Média, Alta, Crítica
- Responsável pelo teste
- Filtro por módulo, prioridade e busca por texto

### 🔁 Ciclos de Teste
- Versão, período (início/fim), tipos de teste
- Adição de casos de teste ao ciclo com busca e seleção em massa
- Execução individual por caso:
  - Status: Passou, Falhou, Bloqueado, Não executado
  - Comentário e observações
  - Upload de evidências (imagens, PDF, ZIP)
  - URL de evidência externa
  - Vínculo com bug
  - Registro de quem executou e quem é o responsável

### 🐛 Bugs
- Vínculo automático de módulo pelo título `[NomeDoMódulo]`
- Vínculo com caso de teste
- Link do tracker externo (ClickUp, Jira, etc)
- Upload de arquivos de evidência
- Criado por (registrado automaticamente)
- Severidade: Baixa, Média, Alta, Crítica
- Status: Aberto, Em andamento, Corrigido, Fechado

### 📊 Dashboard
- Métricas globais: taxa de sucesso, falha, bloqueados
- Gráficos de pizza por status de execução e bugs
- Gráfico de barras por módulo
- Cards de cada ciclo com período, duração e resultado
- Tabelas de métricas por módulo e bugs por módulo

### 👥 Usuários & Permissões
- **Admin** — acesso total, gerencia usuários
- **Editor** — cria e edita testes, ciclos e bugs
- **Visualizador** — somente leitura

### ⬇ Exportação Excel
- Download em `.xlsx` com 6 abas coloridas:
  - Resumo, Casos de Teste, Ciclos, Execuções, Bugs, Módulos

### 💾 Backup & Restauração
- Download do banco completo em `.db`
- Restauração via upload do arquivo de backup
- Backup de segurança automático antes de qualquer restauração

---

## 💾 Backup do Banco de Dados

### Como fazer backup

1. Acesse o sistema como **Admin**
2. No menu lateral clique em **💾 Backup**
3. Clique em **"⬇ Baixar Backup (.db)"**
4. Salve o arquivo `qa_backup_DATA.db` em local seguro

> Recomendação: faça backup **semanalmente** e guarde no Google Drive ou HD externo.

### Como restaurar um backup

#### Pelo sistema (mais fácil)

1. Acesse o sistema como **Admin**
2. No menu lateral clique em **💾 Backup**
3. Clique em **"⬆ Selecionar arquivo .db"**
4. Escolha o arquivo de backup e confirme
5. Aguarde a mensagem de sucesso
6. **Recarregue a página** para ver os dados atualizados

> ⚠️ O sistema salva automaticamente um backup do banco atual antes de restaurar, como proteção extra.

#### Manualmente (desenvolvimento local)

1. Para o servidor (`Ctrl+C`)
2. Navegue até:
   ```
   C:\Users\Helena\Documents\qa-backend\backend\data\
   ```
3. Apague o arquivo `qa_system.db`
4. Copie o arquivo de backup para essa pasta
5. Renomeie para `qa_system.db`
6. Inicie o servidor novamente:
   ```bash
   npm run dev
   ```

#### Em produção no Render (via Shell)

1. Acesse [render.com](https://render.com) → seu serviço `qa-manager-api`
2. Clique na aba **Shell**
3. O banco fica em `/data/qa_system.db`
4. Use o endpoint de restore pelo sistema — é mais fácil

### O que está incluído no backup

| ✅ Incluído | ❌ Não incluído |
|---|---|
| Projetos | Arquivos de evidência (imagens, PDFs) |
| Usuários e senhas | |
| Módulos e casos de teste | |
| Ciclos e execuções | |
| Bugs e comentários | |
| Todas as configurações | |

> Para backup completo em produção, faça também o backup do **Disk** no painel do Render em **Disks → Snapshots**.

---

## 🛠 Tecnologias

### Backend
| Tecnologia | Uso |
|---|---|
| **Node.js** | Runtime JavaScript |
| **Express** | Framework HTTP |
| **sql.js** | SQLite via WebAssembly (sem compilação nativa) |
| **Multer** | Upload de arquivos |
| **CORS** | Comunicação cross-origin |

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
| **Render** | Hospedagem do backend (gratuito) |
| **Netlify** | Hospedagem do frontend (gratuito) |
| **GitHub** | Repositório e CI/CD |

---

## 🚀 Instalação local

### Pré-requisitos
- Node.js 18+
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
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Frontend (`.env.local`)
```env
# Só necessário em produção
VITE_API_URL=https://qa-manager-api.onrender.com
```

---

## 📁 Estrutura do projeto

```
qa-manager/
├── backend/
│   ├── src/
│   │   ├── server.js              # Entrada da aplicação
│   │   ├── database/
│   │   │   ├── connection.js      # Conexão SQLite
│   │   │   ├── migrations.js      # Criação das tabelas
│   │   │   └── seed.js            # Dados de exemplo
│   │   ├── routes/                # Endpoints HTTP
│   │   ├── controllers/           # Request/Response
│   │   ├── services/              # Lógica de negócio
│   │   ├── middlewares/           # Auth, upload, erros
│   │   └── utils/                 # Helpers de resposta
│   ├── uploads/                   # Arquivos enviados
│   ├── data/                      # Banco SQLite
│   ├── package.json
│   └── render.yaml                # Config deploy Render
│
└── frontend/
    ├── src/
    │   ├── App.jsx                # Roteamento principal
    │   ├── main.jsx               # Entrada React
    │   ├── context/               # Auth + Projeto
    │   ├── pages/                 # Dashboard, Bugs, Ciclos...
    │   ├── components/            # UI, FileUpload, ExportButton
    │   ├── services/              # Chamadas à API
    │   └── hooks/                 # useAsync
    ├── package.json
    └── netlify.toml               # Config deploy Netlify
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
| POST | `/api/cycles/:id/executions` | Adicionar casos ao ciclo |
| PUT | `/api/cycles/:id/executions/:execId` | Atualizar execução |
| POST | `/api/cycles/:id/executions/:execId/evidence` | Upload evidência |
| GET/POST | `/api/bugs` | Bugs |
| POST | `/api/bugs/:id/files` | Upload arquivo bug |
| GET | `/api/dashboard` | Métricas |
| GET | `/api/export` | Dados para exportação Excel |
| GET | `/api/backup/info` | Informações do banco |
| GET | `/api/backup/download` | Download do banco (.db) |
| POST | `/api/backup/restore` | Restaurar banco (.db) |
| GET | `/api/health` | Health check |

---

## 🔐 Perfis de acesso

| Perfil | Permissões |
|---|---|
| **Admin** | Tudo + gerenciar usuários, projetos e backup |
| **Editor** | Criar e editar testes, ciclos e bugs |
| **Visualizador** | Somente leitura |

---

## 📦 Deploy

### Backend — Render
1. Conecte o repositório no [render.com](https://render.com)
2. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
3. Adicione um **Disk** com mount path `/data`
4. Variáveis de ambiente: `NODE_ENV=production`, `FRONTEND_URL=<url-netlify>`

### Frontend — Netlify
1. Conecte o repositório no [netlify.com](https://netlify.com)
2. Configure:
   - **Build command:** `cd frontend && npm install && npm run build`
   - **Publish directory:** `frontend/dist`
3. Variável de ambiente: `VITE_API_URL=<url-render>`

---


