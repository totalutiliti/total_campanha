# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# tc-web — Next.js 14 (standalone output). Build a partir da raiz do monorepo:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.totalcampanha.com.br/api/v1 \
#     -t tc-web .
#
# NEXT_PUBLIC_* é embutido em build time — precisa ser passado como build-arg.
# ---------------------------------------------------------------------------

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @total-campanha/web...

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @total-campanha/shared build
RUN pnpm --filter @total-campanha/web build

# ---------- runtime ----------
# Requer `output: 'standalone'` no next.config.mjs.
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:3000 || exit 1
CMD ["node", "apps/web/server.js"]
