# syntax=docker/dockerfile:1.6
FROM node:20-bullseye-slim AS base
ENV PNPM_HOME=/root/.local/share/pnpm \
    NODE_ENV=production
RUN corepack enable
WORKDIR /srv/app

# Copy root manifests
COPY ../../package.json ../../pnpm-lock.yaml ../../.pnpm-workspace.yaml ./
COPY ../../tsconfig*.json ./

# Copy workspace metadata
COPY ../../apps ./apps
COPY ../../packages ./packages
COPY ../../prisma ./prisma

# Install dependencies for the API workspace only
RUN pnpm install --filter @marketing-afiliados/api... --frozen-lockfile

# Build step placeholder (actual build to be implemented in fases posteriores)
# RUN pnpm --filter @marketing-afiliados/api build

CMD ["pnpm", "--filter", "@marketing-afiliados/api", "run", "dev"]
