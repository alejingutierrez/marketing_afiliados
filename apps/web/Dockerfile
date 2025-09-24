# syntax=docker/dockerfile:1.6
FROM node:20-bullseye-slim AS base
ENV PNPM_HOME=/root/.local/share/pnpm \
    NODE_ENV=production
RUN corepack enable
WORKDIR /srv/app

COPY ../../package.json ../../pnpm-lock.yaml ../../.pnpm-workspace.yaml ./
COPY ../../tsconfig*.json ./
COPY ../../apps ./apps
COPY ../../packages ./packages

RUN pnpm install --filter @marketing-afiliados/web... --frozen-lockfile

# Placeholder build step for future Next.js bundling
# RUN pnpm --filter @marketing-afiliados/web build

CMD ["pnpm", "--filter", "@marketing-afiliados/web", "run", "dev"]
