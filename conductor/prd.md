# Product Requirements Document (PRD)

Product: Tutor Advantage Ecosystem Pivot  
Version: 1.0 (Draft)  
Date: 2026-02-23  
Owner: Product + Engineering

## 1. Executive Summary

Tutor Advantage is pivoting from a legacy web-first codebase to a backend-first tutoring ecosystem for Thailand.

The first release objective is not a consumer mobile launch. It is a production backend foundation with:

- identity and access,
- class/referral/enrollment flow,
- student payments (PromptPay + cards),
- and automated monthly MLM settlement with finance approval workflow.

Web/LIFF sequence after backend completion:

1. Tutor PWA
2. Student LINE LIFF portal

## 2. Business Context

### 2.1 Strategic Shift

- Previous school-sales channel is no longer viable.
- Business is shifting to tutor-led class sales and direct student payment.
- Existing printed workbooks with QR article links must remain valid.

### 2.2 Core Commercial Model

- Tutor creates class packages (one class package = one book in V1, approx. 25 hours for ~2500 THB).
- Value proposition: Tutors project a 15-step scripted lesson plan, providing them a low-prep system and fair pay, while students receive quality instruction with additional time in the student app.
- Tutor shares class-bound referral links/QR codes via their own channels (Facebook/LINE).
- Student or guardian creates account/signs in, pays company directly on the company website, then enrollment activates.
- MLM commissions are calculated from current transaction volume in the network with continuous-rate logic.

## 3. Goals and Non-Goals

### 3.1 Product Goals

1. Build production backend services with clear domain separation.
2. Ship reliable payment and settlement foundation before mobile rollout.
3. Preserve all legacy workbook QR URL behavior.
4. Enforce guardian and consent controls suitable for underage users.
5. Support monthly, auditable MLM payout operations.

### 3.2 Non-Goals (V1)

1. Full campaign analytics dashboards.
2. Multi-currency support.
3. Generic public influencer campaign tooling.
4. Full tutor PWA/student LIFF UX scope in this track.

## 4. Personas and Jobs-to-be-Done

### 4.1 Tutor

- Create and own classes.
- Share referral link/QR for class signup.
- Teach enrolled students.
- Track earnings and settlement outcomes.

### 4.2 Student / Guardian

- Join a class from link/QR.
- Complete secure payment.
- Access class and communication channels.

### 4.3 Finance Admin

- Run settlement preview.
- Review and approve/reject payout batches.
- Enter adjustments and export CSV for accounting.
- Audit all payout-affecting actions.

### 4.4 Operations/Admin

- Resolve enrollment/payment exceptions.
- Manage unresolved legacy QR links gracefully.

## 5. Scope Definition

## 5.1 In-Scope Domains

- Identity: OAuth login, role model, guardian/consent checks.
- Learning: class ownership, referral placement, enrollment activation.
- Finance/MLM: payment event intake, settlement engine, payout approval workflow.
- Legacy compatibility: unchanged URL resolution and fallback.

## 5.2 Out-of-Scope Domains

- LMS richness beyond enrollment/activation basics.
- Full content authoring suite.
- Advanced BI dashboards and attribution modeling.

## 6. Functional Requirements

### FR-001 Service Architecture

- Three services: `identity`, `learning`, `finance_mlm`.
- REST APIs with contract validation.
- Separate Postgres schemas with strict role-bound access.

Acceptance:
- Each service deploys independently.
- Cross-schema writes fail unless explicitly allowed via integration path.

### FR-002 Authentication and Access

- Providers: Tutors use Facebook + Google (PWA). Students exclusively use LINE Login (LIFF).
- Role-aware sessions for tutor/student/guardian/admin.
- Guardian-required flow for underage users before payment/contact consent.

Acceptance:
- Underage student cannot complete payment/contact permissions without guardian state.

### FR-003 Tutor Class Lifecycle

- Tutor-only class creation and ownership.
- Tutor schedules the class hours in the system calendar based on client availability.
- Class status supports open/full/closed.
- Referral links expire when class is full or closed.
- **Class Reassignment / Auction:** If a tutor abandons a class, the system supports an "auction page" where local, long-term tutors can take over the remaining enrollments, potentially accepting a discount to gain residual network income and student retention.

Acceptance:
- Non-tutor class creation rejected.
- Expired links cannot enroll into closed/full class.
- Abandoned classes can be reassigned to active tutors.

### FR-004 Referral Placement

- Referral links are class-bound.
- If class unavailable, system offers same tutor's other open classes first.
- Attribution must remain consistent during fallback.

Acceptance:
- Closed-class referral flow produces same-tutor alternatives before marketplace fallback.

### FR-005 Payment and Enrollment Activation

- Student-pay flow in THB, processed entirely within the student's LINE LIFF portal (bypassing mobile app store billing).
- 100% upfront payment required before active enrollment.
- Payment success creates commissionable event.

Acceptance:
- Enrollment state transitions to active only after verified success event.

### FR-006 Refund and Chargeback Handling

- Negative payment outcomes become adjustments for next settlement period.

Acceptance:
- Month N+1 chargeback appears as clawback in month N+1 settlement run.

### FR-007 MLM Commission and Settlement

- Monthly settlement in ICT (UTC+7) calendar month.
- Continuous differential payout algorithm on network volume.
- Eligibility requires at least one individual course sale per month.
- Inactive nodes are compressed.
- Upline reassignment blocked after activation.
- **Volume Metric:** The exact actual paid THB amount (post-discount) is the strict and only input for the MLM volume calculations. No artificial multipliers.
- **Math Standard:** All internal ledger and commission math must use **Satang (Value * 100)** stored as Integers to prevent rounding errors.

Acceptance:
- Deterministic rerun with same inputs produces same outputs.
- Ineligible nodes do not receive payout for period.
- No fractional-baht rounding discrepancies in the ledger.

### FR-008 Payout Approval Controls

- Settlement run preview.
- Approval/rejection of payout batch.
- **Makers-Checkers Workflow:** All manual adjustments require entry by one admin and approval by a different, higher-level admin.
- Manual adjustment entry with mandatory reason codes.
- CSV export.
- Immutable action audit logs.

Acceptance:
- No payout release without finance approval event.
- All payout-affecting actions are queryable in audit trail with two-party verification records.

### FR-009 Legacy URL Compatibility

- Existing printed article URLs (`domain.com/student/read/[articleID]`) must resolve unchanged.
- Unknown legacy URLs route to graceful fallback with support path.

Acceptance:
- Known URL regression set resolves exactly.
- Unknown URL never hard-fails without recovery option.

### FR-010 PDPA and Consent Management

- Versioned consent logs for all users, particularly for minor/guardian relationships.
- Support for "Right to be Forgotten" and data portability requests.
- **Soft Delete / Anonymization Strategy:** To balance PDPA with immutable financial ledgers, deletion requests result in PII (name, email, phone) being overwritten with cryptographic hashes or placeholders in the `identity-service`, while UUIDs and transactional history remain intact in the `finance-mlm-service`.
- Immutable audit trail of consent events (Privacy Sources to Privacy Sinks).

### FR-011 LINE Official Account Integration (LIFF)

- The entire student experience is built as a LINE LIFF app, providing zero-friction access.
- Push notifications for payment success, class reminders, and benchmark results.
- Deep-linking from LINE messages directly into specific LIFF views (e.g., a specific article or class).
- Maintain in-app chat within the LIFF portal as the "System of Record" for legal/audit purposes.

### FR-012 Aggressive Caching (PWA/LIFF)

- Service Workers for both the Tutor PWA and Student LIFF portal to aggressively pre-cache the current active content (e.g., current book's assets).
- Replaces the need for a fully offline-first native app due to reliable 4G coverage.

### FR-013 Tutor Training and Quality Benchmarks

- Benchmark assessments integrated into the program to measure student growth.
- Gamification (badges/bonuses) for tutors who consistently achieve high student growth.
- Visibility for Uplines into Trainee growth metrics to support the "10% training time" culture.

## 7. MLM Math and Policy Rules

## 7.1 Continuous Rate Function

Business-specified rate function:

`rate(V) = IF(V >= 20000, B1*(1-0.3^(1+LOG(V/20000,5)))/0.7, 0.4 + V/200000)`

Where:

- `V`: period volume input
- `B1`: base commission percentage parameter
- Output unit: decimal fraction (`0.5` = 50%)

## 7.2 Differential Tree Payout

Use bottom-up payout:

1. `PV(node)` = direct class sales volume for node in settlement period.
2. `GV(node)` = `PV(node) + sum(GV(child))`.
3. `R(node)` = rate function output for node's qualifying volume basis.
4. `Payout(node)` = `max(0, R(node)*GV(node) - sum(Payout(child)))`.

## 7.3 Settlement Integrity Constraints

- **THB-only ledger using Satang (Integers).**
- High precision internal calculations; round only at final tutor-period output.
- No reserve/holdback in V1 (company accepts chargeback risk to ensure immediate tutor profitability).
- Refund/chargeback clawback next period.
- **10% Re-up Discount:** Modeled as a price override where the tutor absorbs 7% of the discount and the company absorbs 3%.
- Finance approval gate with Makers-Checkers validation required before payout release.

## 8. Data Model Requirements

### 8.1 Identity Domain

- Users
- OAuth identities
- Guardian linkage
- Role assignments
- Consent records
- Sponsor/upline metadata with post-activation immutability

### 8.2 Learning Domain

- Series, levels, books, articles
- Class packages (one book per class package)
- Tutor class ownership
- Referral links/QR payloads
- Enrollment applications and active enrollments

### 8.3 Finance/MLM Domain

- Payment intents/events
- Ledger transactions
- Settlement run snapshots
- Payout batches and line items
- Adjustment entries
- Audit events

## 9. API Requirements (V1)

Required endpoint groups:

- Auth callbacks/session/profile
- Tutor class CRUD and status management
- Referral create/resolve/expire
- Enrollment create and activation status
- Payment intent create + webhook outcome ingestion
- Settlement preview/run/list/detail
- Payout batch approve/reject/export
- Audit trail query

All APIs must include:

- idempotency strategy,
- auth scope checks,
- and validation/error contract consistency.

## 10. Security and Compliance Requirements

1. OAuth provider tokens are never trusted directly for authorization decisions.
2. Authorization is role-checked server-side on all protected endpoints.
3. Guardian and user consent events are stored with immutable history.
4. Money events and payout approvals are tamper-evident via immutable audit logs.
5. Legal and policy specifics for child data handling and messaging must be reviewed with counsel before production.

## 11. Observability and Operations

Minimum operational telemetry:

- Service health and error rate
- Payment webhook success/failure and replay detection
- Settlement run duration and failure diagnostics
- Payout approval throughput and rejection reasons
- Legacy URL fallback hit-rate

Operational artifacts:

- Settlement runbook
- Payout incident response playbook
- Legacy URL fallback triage guide

## 12. Success Metrics

### 12.1 Product Metrics

- Referral-to-enrollment conversion rate
- Payment success rate
- Class fill rate by tutor
- Enrollment activation latency after payment

### 12.2 Finance Metrics

- Settlement accuracy (manual correction rate)
- Payout approval cycle time
- Refund/chargeback clawback recovery rate

### 12.3 Trust/Risk Metrics

- Legacy QR unresolved rate
- Consent completion rate
- Dispute incidence per 1,000 payments

## 13. Rollout Plan

### Milestone 1 (Backend Foundation)

- Production-grade APIs for identity/learning/finance-mlm
- Automated monthly settlement engine
- Finance approval console with audit and exports

### Milestone 2 (Tutor PWA)

- Tutor class creation and referral operations
- Basic enrollment and communication workflows

### Milestone 3 (Student LINE LIFF Portal)

- Referral onboarding/payment/enrollment access
- In-app communication and progression access

## 14. Dependencies and Risks

### Dependencies

- Payment processor capability for PromptPay + local card flows
- OAuth app review and provider policy compliance
- Legacy URL mapping and data migration readiness

### Top Risks

1. Settlement correctness risk under complex MLM tree edge cases.
2. Referral attribution ambiguity during class full/closed fallback.
3. Operational risk if payout automation is enabled without approval gating.
4. Migration risk to preserve printed URL continuity.

### Mitigations

- Deterministic replay tests for settlements.
- Explicit attribution rules and immutable snapshots.
- Approval-first payout release policy in V1.
- Regression corpus for known legacy URLs before cutover.

## 15. Open Items (To Resolve in Implementation)

1. Final gateway payout rail capability and operational fallback details.
2. Formal legal review outputs for guardian/consent policy text and retention.
3. Exact rounding scale and banker-vs-standard rounding rule at payout boundary.
4. SLA targets for webhook ingestion and settlement batch windows.
