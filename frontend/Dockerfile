# ── Build stage: gera os arquivos estáticos com o Vite ──────────
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# no Docker a tela fala com o backend do próprio compose (via nginx, em /api) e NÃO com o servidor publicado no .env.production
ENV VITE_API_URL=""
RUN npm run build

# ── Runtime stage: serve os arquivos estáticos com Nginx ────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
