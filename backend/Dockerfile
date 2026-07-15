# ── Build stage: compila TypeScript para JS puro ────────────────
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── Runtime stage: só o necessário pra rodar em produção ────────
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 3001
CMD ["node", "dist/server.js"]
