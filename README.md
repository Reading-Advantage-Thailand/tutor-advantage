# Tutor Advantage

Tutor Advantage is a TypeScript monorepo containing three backend services and
three Next.js applications:

- `identity-service` — authentication, profiles, roles, and guardian consent
- `learning-service` — classes, enrollment, lessons, and realtime sessions
- `finance-mlm-service` — payments, settlement, payouts, and finance operations
- `student-liff`, `tutor-pwa`, and `admin-console` — user-facing applications

## Prerequisites

- Node.js 20
- npm
- PostgreSQL 16 for integration tests and local services

Copy `.env.example` to `.env` and provide the required secrets and database
connection. Production services fail startup when required security settings
are absent. Development-only routes also require `ENABLE_DEV_ROUTES=true` and
are never registered in production.

## Install and generate

```bash
npm ci
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

## Importing Primary Advantage articles

Primary course and article catalogues are read from the local Reading Advantage
Workbook repository. Set `DATABASE_URL_PRIMARY_ADVANTAGE` when Primary's live
content database is available, then run:

```bash
npm run import:primary-workbooks -w @tutor-advantage/database
```

The import is safe to re-run. It uses workbook titles and ordering to map to
published Primary articles, then stores only the resulting Primary article IDs.
All lesson details are read from the Primary database at runtime; users,
classrooms, assignments, and progress are never copied.

Generated `dist/`, `.next/`, coverage, service-worker, and Prisma client outputs
are intentionally not committed.

## Test and build

```bash
npm test
npm run test:coverage
npm run contract:check
npm run lint
npm run build:services
npm run build
```

The root test and build commands compile shared packages first. OpenAPI request
validation runs in every environment; response validation runs in tests/CI or
when `OPENAPI_VALIDATE_RESPONSES=true`.

Integration tests require a dedicated PostgreSQL database whose name contains
`test`:

```bash
copy .env.integration.example .env.integration
npm run test:integration
```

Set `SKIP_INTEGRATION_TESTS=1` only when checking test compilation without a
database.

## Database migrations

Create migrations during development:

```bash
npx prisma migrate dev --schema=packages/database/prisma/schema.prisma
```

Apply the committed migration chain in CI or deployment:

```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npx prisma migrate status --schema=packages/database/prisma/schema.prisma
```

Do not use `prisma db push` for integration CI or production deployment.

## Deployment

GitHub Actions runs lint, coverage, contract checks, clean-database migration
tests, integration tests, and all builds. Deployment is allowed only for the
same commit after CI succeeds. A one-off migration job runs before application
services; a failed migration blocks deployment.

Service Dockerfiles use Node.js 20 and build shared packages from source. The
OpenAPI specifications under `packages/contracts/openapi` are copied into each
runtime image.

Operational procedures for settlement are in
`docs/runbooks/settlement-runbook.md`.
