# Build context: monorepo root
# docker build -f apps/student-liff/Dockerfile .
# Requires --build-arg NEXT_PUBLIC_LIFF_ID (set as GitHub secret NEXT_PUBLIC_LIFF_ID)
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/student-liff/package.json ./apps/student-liff/

RUN npm ci

COPY apps/student-liff/ ./apps/student-liff/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars are inlined at build time — must be provided as build args
ARG NEXT_PUBLIC_LIFF_ID
ENV NEXT_PUBLIC_LIFF_ID=$NEXT_PUBLIC_LIFF_ID

ARG NEXT_PUBLIC_LIFF_INSPECTOR_URL
ENV NEXT_PUBLIC_LIFF_INSPECTOR_URL=$NEXT_PUBLIC_LIFF_INSPECTOR_URL

RUN npm run build -w student-liff

FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/student-liff/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/student-liff/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/student-liff/.next/static ./apps/student-liff/.next/static

USER nextjs

EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/student-liff/server.js"]
