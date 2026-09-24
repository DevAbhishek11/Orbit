# Orbit API Dockerfile — multi-stage, non-root, healthcheck
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY shared/package.json ./shared/package.json
COPY orbitserver/package.json ./orbitserver/package.json
RUN npm ci --no-audit --no-fund --workspace=shared --workspace=orbitserver
COPY shared ./shared
COPY orbitserver ./orbitserver
RUN npm run build --workspace=shared && npm run build --workspace=orbitserver

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S orbit && adduser -S orbit -G orbit
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/orbitserver/dist ./orbitserver/dist
COPY --from=builder /app/orbitserver/package.json ./orbitserver/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
USER orbit
EXPOSE 8010
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:8010/health/live || exit 1
CMD ["node", "orbitserver/dist/server.js"]
