# Build context: monorepo root
# docker build -f services/identity-service/Dockerfile .
FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/database/package.json      ./packages/database/
COPY services/identity-service/package.json ./services/identity-service/

# Prisma schema must exist before npm ci: the database package's `prepare`
# script runs `prisma generate` during install
COPY packages/database/prisma ./packages/database/prisma

RUN npm ci

COPY packages/shared-config/ ./packages/shared-config/
COPY packages/database/      ./packages/database/
COPY services/identity-service/ ./services/identity-service/

RUN npm run build -w @tutor-advantage/shared-config
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w @tutor-advantage/database
RUN npm run build -w identity-service

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/database/package.json      ./packages/database/
COPY services/identity-service/package.json ./services/identity-service/

# Prisma schema must exist before npm ci (see builder stage note)
COPY packages/database/prisma ./packages/database/prisma

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/packages/database/dist      ./packages/database/dist
COPY --from=builder /app/services/identity-service/dist ./services/identity-service/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

EXPOSE 8080

CMD ["node", "services/identity-service/dist/index.js"]
