# syntax=docker/dockerfile:1

# Settle — one small Node process serving the API and the built client. No database.
#   docker build -t settle .
#   docker run --rm -p 3000:3000 --env-file .env settle
# Issue a Pro code from the running container:
#   docker exec <container> node scripts/license.mjs issue --plan pro_yearly

# ---- Build: install everything, typecheck, bundle client + server ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Runtime: production dependencies, the build output and the license CLI -
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts

# The official image ships an unprivileged "node" user.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "dist/server/index.js"]
