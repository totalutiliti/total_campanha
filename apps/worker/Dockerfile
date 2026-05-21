# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# tc-worker — NestJS standalone (BullMQ). Build a partir da raiz do monorepo:
#   docker build -f apps/worker/Dockerfile -t tc-worker .
# ---------------------------------------------------------------------------

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile --filter @total-campanha/worker...

FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm --filter @total-campanha/db generate
RUN pnpm --filter @total-campanha/shared build
RUN pnpm --filter @total-campanha/worker build
RUN pnpm --filter @total-campanha/worker... --prod deploy /app/deploy-worker

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/deploy-worker/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
# Worker não expõe HTTP — sem EXPOSE/HEALTHCHECK de porta.
CMD ["node", "dist/main.js"]
