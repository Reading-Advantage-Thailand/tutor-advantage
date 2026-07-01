# Build context: monorepo root
# docker build -f apps/tutor-pwa/Dockerfile .
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/tutor-pwa/package.json ./apps/tutor-pwa/

RUN npm ci

COPY apps/tutor-pwa/ ./apps/tutor-pwa/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build -w tutor-pwa

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/tutor-pwa/public ./apps/tutor-pwa/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/tutor-pwa/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/tutor-pwa/.next/static ./apps/tutor-pwa/.next/static

USER nextjs

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "if [ ${#JWT_SECRET} -lt 32 ]; then echo 'FATAL: JWT_SECRET must be at least 32 characters' >&2; exit 1; fi; exec node apps/tutor-pwa/server.js"]
