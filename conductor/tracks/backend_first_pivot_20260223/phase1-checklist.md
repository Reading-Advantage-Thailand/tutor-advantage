# Phase 1 Checklist: Foundation and Contracts

Track: `backend_first_pivot_20260223`  
Date: 2026-02-23

## Objective

Ship the first milestone baseline:

- production-ready backend foundations for `identity`, `learning`, `finance_mlm`
- contract-first REST specs
- Cloud SQL schema and service-role boundary setup stubs

## Entry Criteria

- [ ] Product/PRD approved for backend-first direction
- [ ] Track spec and plan accepted
- [ ] Team agrees on Node.js + TypeScript service baseline
- [ ] Cloud SQL access path defined for dev/staging

## Deliverables

- [x] `packages/contracts/openapi/identity.v1.yaml`
- [x] `packages/contracts/openapi/learning.v1.yaml`
- [x] `packages/contracts/openapi/finance-mlm.v1.yaml`
- [x] Prisma schema at `packages/database/prisma/schema.prisma`
- [x] Ordered migrations at `packages/database/prisma/migrations`

## Work Breakdown

### A. Service Workspace Baseline

- [x] Define service folder convention and naming
- [x] Add shared config conventions (`env`, `logging`, `request-id`, `error envelope`)
- [x] Add health endpoint contract for all services
- [x] Add version endpoint contract for all services

Verification:

- [x] Health and version routes are represented in each OpenAPI contract

### B. Contract-First API Definitions

- [x] Identity contract drafted (auth callback/session/profile/guardian)
- [x] Learning contract drafted (class lifecycle/referral/enrollment)
- [x] Finance contract drafted (payments/settlement/payout approval/audit)
- [x] Common error schema standardized across services
- [x] Payment idempotency field/header behavior implemented

Verification:

- [x] OpenAPI files validate through contract middleware tests
- [x] Required V1 endpoint groups exist
- [x] CI checks documented critical routes against implementations

### C. Cloud SQL Schema Boundary Setup

- [x] Create domain schemas (`identity`, `learning`, `finance_mlm`, `legacy_bridge`)
- [ ] Define service DB roles with least privilege
- [ ] Define default privileges and sequence usage policies
- [x] Migration ordering is enforced by Prisma migration history and deployment gates

Verification:

- [ ] Boundary tests prove cross-domain write denial by default

### D. Readiness Gates for Phase 1 Complete

- [ ] API contracts reviewed by backend and app teams
- [ ] Schema ownership model approved by engineering lead
- [ ] Risk list for payments and settlement captured
- [ ] Transition notes for legacy URL constraints captured

## Open Decisions (Must Close Before Phase 2 Build)

- [ ] Exact OAuth callback URL matrix by environment
- [x] Payment gateway webhook signature and replay handling
- [x] Settlement scheduling through authenticated Cloud Scheduler job
- [x] Currency represented as integer Satang with safe-integer API contracts

## Done Definition

Phase 1 is complete when:

1. Contract files and schema stubs are merged and versioned.
2. Teams can begin implementation against stable endpoint contracts.
3. DB boundary model is explicit enough to prevent accidental monolith coupling.
