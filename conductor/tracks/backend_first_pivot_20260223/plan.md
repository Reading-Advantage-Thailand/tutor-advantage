# Implementation Plan: Backend-First Pivot Foundation

Track ID: `backend_first_pivot_20260223`

## Phase 1: Foundation and Contracts

- [ ] Task: Establish backend workspace structure for `identity`, `learning`, and `finance-mlm` services
  - [ ] Write tests that assert service health endpoints and contract version responses
  - [ ] Implement service skeletons and shared config for environment, logging, and auth middleware
- [ ] Task: Define REST API contracts (OpenAPI) for core V1 flows
  - [ ] Write contract tests for auth callback/session, class creation, enrollment, payment webhook intake, settlement preview
  - [ ] Implement OpenAPI specs and request/response validation middleware
  - [ ] **Ensure all currency fields in contracts are defined as Integers (Satang).**
- [ ] Task: Configure Cloud SQL schema ownership and service DB roles
  - [ ] Write integration tests that verify allowed/blocked cross-schema operations
  - [ ] Implement schema migrations and DB role grants for strict service boundaries

## Phase 2: Identity and Access

- [ ] Task: Implement Facebook + Google OAuth (Tutors) and LINE Login (Students) account linkage in `identity-service`
  - [ ] Write tests for new user creation, provider linking, duplicate prevention, and login replay
  - [ ] Implement provider handlers and identity mapping tables
- [ ] Task: Implement role and guardian-required eligibility checks
  - [ ] Write tests for underage flows requiring guardian before payment/contact consent
  - [ ] Implement policy enforcement endpoints and consent state transitions
  - [ ] **Implement versioned consent logging for PDPA compliance.**
- [ ] Task: Block sponsor/upline reassignment after activation
  - [ ] Write tests for allowed pre-activation assignment and denied post-activation changes
  - [ ] Implement immutable post-activation sponsor guardrails

## Phase 3: Learning Enrollment and Referral Flow

- [ ] Task: Implement tutor-owned class creation and lifecycle
  - [ ] Write tests for tutor-only create/update permissions and class close/full states
  - [ ] Implement class ownership model and state transitions
- [ ] Task: Implement class-bound referral links and QR payload API
  - [ ] Write tests for referral generation, expiry-on-close/full, and attribution persistence
  - [ ] Implement referral token creation, validation, and tracking events
- [ ] Task: Implement enrollment placement behavior
  - [ ] Write tests for primary class enrollment and full/closed fallback to same tutor open classes
  - [ ] Implement class placement orchestration and enrollment activation gating
  - [ ] **Optimize learning content APIs to support aggressive Service Worker pre-caching for PWA/LIFF (manifests/asset-lists).**

## Phase 4: Payments and Financial Events

- [ ] Task: Implement student-pay checkout flow with THB-only constraints
  - [ ] Write tests for payment intent creation, successful payment activation, and duplicate payment idempotency
  - [ ] Implement payment intent lifecycle and post-payment enrollment activation
- [ ] Task: Integrate gateway webhook ingestion for payment outcomes
  - [ ] Write tests for signature verification, replay defense, and outcome mapping
  - [ ] Implement webhook handler and durable event store
  - [ ] **Implement LINE OA transactional notification trigger.**
- [ ] Task: Implement refund/chargeback event recording for next-period clawbacks
  - [ ] Write tests ensuring clawback entries are created in the correct future settlement period
  - [ ] Implement negative adjustment event pipelines

## Phase 5: MLM Settlement Engine and Finance Console

- [ ] Task: Implement monthly ICT settlement windowing and run snapshots
  - [ ] Write deterministic tests for period boundaries and rerun consistency
  - [ ] Implement settlement run creation with immutable snapshot metadata
- [ ] Task: Implement differential tree payout algorithm with continuous rate input
  - [ ] Write math regression tests for bottom-up payout, compression, and one-paying-student eligibility
  - [ ] Implement precision-safe payout computation and final-output rounding
  - [ ] **Verify integer-based Satang math across all engine components.**
- [ ] Task: Implement finance approval console APIs and basic admin UI
  - [ ] Write tests for preview, approve/reject transitions, adjustment entry, and CSV export
  - [ ] Implement admin endpoints and web console for payout batch control
  - [ ] **Implement Makers-Checkers workflow for all manual adjustments.**
- [ ] Task: Implement full audit trail for settlement and payout actions
  - [ ] Write tests for immutable log creation on preview/approval/reject/adjust/export actions
  - [ ] Implement append-only audit records and query endpoints

## Phase 6: Legacy URL Compatibility and Hardening

- [ ] Task: Preserve unchanged legacy article URL resolution
  - [ ] Write regression tests for known legacy URL set resolving with exact path behavior
  - [ ] Implement resolver routes and compatibility bridge
- [ ] Task: Implement graceful fallback for unresolved legacy URLs
  - [ ] Write tests for fallback rendering and support/recovery metadata capture
  - [ ] Implement fallback route and support instrumentation
- [ ] Task: Production readiness checks for milestone completion
  - [ ] Write end-to-end tests covering referral -> payment -> enrollment -> settlement preview
  - [ ] Implement deployment checklist artifacts, runbooks, and smoke-test scripts
