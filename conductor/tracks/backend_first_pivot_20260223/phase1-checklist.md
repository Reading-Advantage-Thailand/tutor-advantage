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

- [ ] `backend/contracts/openapi/identity.v1.yaml`
- [ ] `backend/contracts/openapi/learning.v1.yaml`
- [ ] `backend/contracts/openapi/finance-mlm.v1.yaml`
- [ ] `backend/schemas/001_schemas_and_roles.sql`
- [ ] `backend/schemas/identity.sql`
- [ ] `backend/schemas/learning.sql`
- [ ] `backend/schemas/finance_mlm.sql`

## Work Breakdown

### A. Service Workspace Baseline

- [ ] Define service folder convention and naming
- [ ] Add shared config conventions (`env`, `logging`, `request-id`, `error envelope`)
- [ ] Add health endpoint contract for all services
- [ ] Add version endpoint contract for all services

Verification:

- [ ] Health and version contract tests pass for each service

### B. Contract-First API Definitions

- [ ] Identity contract drafted (auth callback/session/profile/guardian)
- [ ] Learning contract drafted (class lifecycle/referral/enrollment)
- [ ] Finance contract drafted (payments/settlement/payout approval/audit)
- [ ] Common error schema standardized across services
- [ ] Idempotency key header policy documented where required

Verification:

- [ ] OpenAPI files validate syntactically
- [ ] Required V1 endpoint groups exist

### C. Cloud SQL Schema Boundary Setup

- [ ] Create domain schemas (`identity`, `learning`, `finance_mlm`, `legacy_bridge`)
- [ ] Define service DB roles with least privilege
- [ ] Define default privileges and sequence usage policies
- [ ] Document migration ordering and ownership boundaries

Verification:

- [ ] Boundary tests prove cross-domain write denial by default

### D. Readiness Gates for Phase 1 Complete

- [ ] API contracts reviewed by backend and app teams
- [ ] Schema ownership model approved by engineering lead
- [ ] Risk list for payments and settlement captured
- [ ] Transition notes for legacy URL constraints captured

## Open Decisions (Must Close Before Phase 2 Build)

- [ ] Exact OAuth callback URL matrix by environment
- [ ] Payment gateway webhook verification mechanism details
- [ ] Settlement run scheduling strategy (cron/job runner implementation)
- [ ] Final decimal precision and rounding scale in persistence layer

## Done Definition

Phase 1 is complete when:

1. Contract files and schema stubs are merged and versioned.
2. Teams can begin implementation against stable endpoint contracts.
3. DB boundary model is explicit enough to prevent accidental monolith coupling.
