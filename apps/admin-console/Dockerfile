# Build context: monorepo root
# docker build -f apps/admin-console/Dockerfile .
FROM node:20-slim AS builder
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/database/package.json      ./packages/database/
COPY apps/admin-console/package.json ./apps/admin-console/

# Prisma schema must exist before npm ci: the database package's `prepare`
# script runs `prisma generate` during install
COPY packages/database/prisma ./packages/database/prisma

RUN npm ci

COPY packages/shared-config/ ./packages/shared-config/
COPY packages/database/      ./packages/database/
COPY apps/admin-console/ ./apps/admin-console/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w @tutor-advantage/shared-config
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w @tutor-advantage/database
RUN npm run build -w admin-console

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin-console/.next/static ./apps/admin-console/.next/static

USER nextjs

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "if [ ${#JWT_SECRET} -lt 32 ]; then echo 'FATAL: JWT_SECRET must be at least 32 characters' >&2; exit 1; fi; exec node apps/admin-console/server.js"]
