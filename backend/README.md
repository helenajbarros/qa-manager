# QA System — Backend

API REST construída com **Node.js + Express + SQLite (better-sqlite3)**.

## Estrutura

```
src/
├── server.js               ← entrada da aplicação
├── database/
│   ├── connection.js       ← singleton da conexão SQLite
│   ├── migrations.js       ← criação de tabelas
│   └── seed.js             ← dados de exemplo (roda 1 vez)
├── routes/                 ← define os endpoints HTTP
├── controllers/            ← trata request/response
├── services/               ← lógica de negócio e queries
├── middlewares/
│   ├── errorHandler.js
│   └── requestLogger.js
└── utils/
    └── response.js         ← helpers padronizados de resposta
```

## Dependências

| Pacote | Motivo |
|--------|--------|
| `sql.js` | SQLite via WebAssembly — **sem compilação nativa**, funciona em Windows/Mac/Linux sem Visual Studio ou Xcode |
| `express` | Framework HTTP |
| `cors` | Habilita CORS para o frontend |

## Instalação

```bash
npm install
npm run dev     # desenvolvimento (nodemon)
npm start       # produção
```

O banco SQLite é criado automaticamente em `data/qa_system.db`.

## Endpoints

| Método   | Rota                                   | Descrição                        |
|----------|----------------------------------------|----------------------------------|
| GET      | /api/health                            | Health check                     |
| GET/POST | /api/modules                           | Listar / criar módulos           |
| GET/PUT/DELETE | /api/modules/:id                 | Detalhar / editar / remover      |
| GET/POST | /api/test-cases                        | Listar / criar casos de teste    |
| GET/PUT/DELETE | /api/test-cases/:id              | Detalhar / editar / remover      |
| GET/POST | /api/cycles                            | Listar / criar ciclos            |
| GET/PUT/DELETE | /api/cycles/:id                  | Detalhar / editar / remover      |
| GET/POST | /api/cycles/:id/executions             | Listar / adicionar execuções     |
| PUT      | /api/cycles/:id/executions/:execId     | Atualizar status de execução     |
| DELETE   | /api/cycles/:id/executions/:execId     | Remover execução                 |
| GET/POST | /api/bugs                              | Listar / criar bugs              |
| GET/PUT/DELETE | /api/bugs/:id                    | Detalhar / editar / remover      |
| GET      | /api/dashboard                         | Todas as métricas                |

## Filtros disponíveis

- `GET /api/test-cases?module_id=1`
- `GET /api/bugs?status=open&severity=high&module_id=2`

## Extração automática de módulo em bugs

Se o título do bug começar com `[NomeDoMódulo]`, o `module_id` é resolvido automaticamente.  
Exemplo: `[Login] Botão Entrar não responde` → vincula ao módulo "Login".
