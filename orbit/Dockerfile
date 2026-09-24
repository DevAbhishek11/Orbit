# Orbit Web Dockerfile — Vite build + Nginx serve
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY shared/package.json ./shared/package.json
COPY orbit/package.json ./orbit/package.json
RUN npm ci --no-audit --no-fund --workspace=shared --workspace=orbit
COPY shared ./shared
COPY orbit ./orbit
RUN npm run build --workspace=shared && npm run build --workspace=orbit

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/orbit/dist /usr/share/nginx/html
COPY orbit/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1/ || exit 1
