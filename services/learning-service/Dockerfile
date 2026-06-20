# =============================================================
# Stage 1: Builder
# Build context must be the monorepo root:
#   docker build -f services/learning-service/Dockerfile .
# =============================================================
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy only the package.json files needed (cache-friendly layer)
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/database/package.json      ./packages/database/
COPY services/learning-service/package.json ./services/learning-service/

# Prisma schema must exist before npm ci: the database package's `prepare`
# script runs `prisma generate` during install
COPY packages/database/prisma ./packages/database/prisma

# Install ALL workspace dependencies (hoisted to root node_modules)
RUN npm ci

# Copy source files
COPY packages/shared-config/ ./packages/shared-config/
COPY packages/database/      ./packages/database/
COPY services/learning-service/ ./services/learning-service/

# Build in order: shared-config → database → service
RUN npm run build -w @tutor-advantage/shared-config
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build -w @tutor-advantage/database
RUN npm run build -w learning-service

# =============================================================
# Stage 2: Runner (lean production image)
# =============================================================
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

# Copy package files for production install
COPY package.json package-lock.json ./
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/database/package.json      ./packages/database/
COPY services/learning-service/package.json ./services/learning-service/

# Prisma schema must exist before npm ci (see builder stage note)
COPY packages/database/prisma ./packages/database/prisma

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/packages/database/dist      ./packages/database/dist
COPY --from=builder /app/services/learning-service/dist ./services/learning-service/dist

# Copy Prisma generated client (hoisted to root node_modules)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema (needed for migrations at runtime if required)
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Cloud Run injects PORT env var (default 8080), service also accepts 3002
EXPOSE 8080

CMD ["node", "services/learning-service/dist/index.js"]
