# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# tc-api — NestJS. Build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t tc-api .
# ---------------------------------------------------------------------------

# ---------- base ----------
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ---------- deps (cache de dependências) ----------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @total-campanha/api...

# ---------- build ----------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @total-campanha/db generate
RUN pnpm --filter @total-campanha/shared build
RUN pnpm --filter @total-campanha/api build
# Remove devDependencies para o runtime.
RUN pnpm --filter @total-campanha/api... --prod deploy /app/deploy-api

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/deploy-api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
EXPOSE 3001
# Health check usa o endpoint /health/live.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:3001/api/v1/health/live || exit 1
CMD ["node", "dist/main.js"]
