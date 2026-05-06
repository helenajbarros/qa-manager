# QA System — Frontend

Interface React construída com **Vite + React Router + Recharts**.

## Estrutura

```
src/
├── main.jsx                  ← entrada da aplicação
├── App.jsx                   ← roteamento principal
├── index.css                 ← estilos globais
├── components/
│   ├── Sidebar.jsx           ← navegação lateral
│   └── UI.jsx                ← Badge, Modal, Loading, Empty, Field...
├── hooks/
│   └── useAsync.js           ← hook genérico de fetch
├── pages/
│   ├── Dashboard.jsx         ← métricas, gráficos (PieChart, BarChart)
│   ├── Modules.jsx           ← CRUD de módulos
│   ├── TestCases.jsx         ← CRUD de casos de teste
│   ├── Cycles.jsx            ← ciclos + execuções de teste
│   └── Bugs.jsx              ← gestão de bugs
└── services/
    ├── api.js                ← cliente HTTP base
    └── resources.js          ← chamadas por recurso
```

## Instalação

```bash
npm install
npm run dev
```

Abre em **http://localhost:5173**

> O Vite já faz proxy de `/api` para `http://localhost:3001` — o backend precisa estar rodando.

## Páginas

| Rota          | Descrição                                    |
|---------------|----------------------------------------------|
| `/`           | Dashboard com métricas e gráficos            |
| `/modules`    | Cadastro de módulos                          |
| `/test-cases` | Cadastro de casos de teste com filtros       |
| `/cycles`     | Ciclos de teste + execução por caso          |
| `/bugs`       | Gestão de bugs com filtros e status rápido   |
