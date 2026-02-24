# Product Definition

Date: 2026-02-23

## Product Vision

Tutor Advantage is pivoting to a backend-first tutoring ecosystem with a Thai-local business model:

- MLM-based tutor network compensation
- Student-pay class enrollment
- Tutor-led classes tied to workbook books
- Mobile-first delivery (tutor app first release after backend, then student app)

## Primary Goals

1. Ship a production-grade backend platform (`identity`, `learning`, `finance/mlm`) before mobile releases.
2. Preserve legacy printed workbook QR links with fully unchanged URLs.
3. Run automated monthly MLM settlement with finance approval before payouts.
4. Launch Thai-local payments (PromptPay and cards) with student-pay flow.
5. Enable tutor class growth via class-bound referral links and QR codes.

## Users

- Tutors: create classes, share class referral links, teach and earn via class sales + network algorithm.
- Students/Guardians: register, pay for class package (one book), join class, communicate with tutor.
- Finance/Admin: run monthly settlement, review payout batches, approve/reject payouts, audit adjustments.

## Confirmed Decisions

## Platform and Sequence

- Backend-first build order
- Then tutor mobile app
- Then student mobile app
- Separate tutor and student mobile apps from day 1
- Capacitor-based offline-first strategy: asynchronous caching for the current book's assets

## Backend Architecture

- Service-oriented from day 1
- Services: `identity`, `learning`, `finance/mlm`
- Interface style: REST
- Data isolation at launch: one Cloud SQL Postgres cluster with separate schemas and strict access boundaries
- First milestone: production-ready backend APIs + settlement engine + admin finance approval console
- Currency Math: All ledger entries stored as **Integers in Satang (Value * 100)** to ensure absolute precision.

## Auth and Communication

- Launch auth providers: Facebook + Google
- Official communication policy: in-app chat as system of record
- Messaging Integration: **LINE Official Account (OA)** for push notifications (payments, class reminders, benchmarks) with deep-linking to the app.
- Underage and Privacy Policy: **PDPA-compliant** guardian-required flow; versioned consent logs in `identity-service` for auditing.

## Payments and Enrollment

- Student-pay model
- Tutors create class-bound referral links/QR codes
- Referral link purpose: place student into specific class flow
- Billing unit: class package tied to exactly one book
- Collection schedule: 100% upfront before enrollment activation
- Payment rails target: Omise for PromptPay + cards (local-first configuration)
- **10% Re-up Discount:** 7% deducted from tutor volume, 3% from company margin; modeled as a price override event.

## MLM and Settlement

- Commission on current class sales volume
- Class owner tutor gets full direct class reward for that transaction
- Network payout uses continuous differential tree algorithm
- Settlement cadence: monthly
- Timezone/cutoff: ICT (UTC+7) calendar month
- Currency: THB-only
- Refund/chargeback handling: clawback in next settlement period
- Payout release: finance approval required with **Makers-Checkers workflow** for all manual adjustments.
- Rounding: high-precision internal math, round only at final tutor-period payout
- Upline changes: not allowed after activation
- Activity eligibility: at least 1 successful paid enrollment in settlement month; inactive nodes compressed
- No reserve/holdback in V1
- **Fraud Prevention:** Volume velocity checks and manual review flags for abnormal enrollment spikes.

## Commission Function Inputs

- `rate(V)` is decimal fraction output (`0.5 = 50%`)
- Trainee branch intentionally high and accepted by business

Reference formula from business rule:

`rate(V) = IF(V >= 20000, B1*(1-0.3^(1+LOG(V/20000,5)))/0.7, 0.4 + V/200000)`

## Content and Migration

- Release scope in V1: Levels 1-6 together (Origins + Quest)
- Legacy G4-12 app is being replaced
- Existing printed workbook QR URLs must remain fully unchanged
- Unresolved legacy URL behavior: graceful fallback page with recovery/support route

## Workbook Program Data (Confirmed)

### Series

| Series | CEFR | RA Levels | Tagline |
|---|---|---|---|
| Origins | A1 | 1-3 | Your journey starts here |
| Quest | A2 | 4-6 | Your quest awaits |
| Adventure | B1 | 7-9 | Your adventure's in sight |
| Hero | B2 | 10-12 | You're the hero in the story |
| Legend | C1 | 13-15 | Legendary stories |

### Book Hour Totals

| Books | Class Hours | Independent Hours | Total |
|---|---:|---:|---:|
| 4 | 90 | 45 | 135 |
| 4 | 100 | 45 | 145 |
| 8 | 200 | 90 | 290 |
| 8 | 200 | 90 | 290 |
| 8 | 200 | 90 | 290 |
| 32 | 790 | 360 | 1150 |

### Levels and Book Counts

| Level | Number of Books | Total Articles | Level Names |
|---:|---:|---:|---|
| 1 | 1 | 14 | Origins 1 |
| 2 | 1 | 14 | Origins 2 |
| 3 | 2 | 28 | Origins 3.1, 3.2 |
| 4 | 1 | 14 | Quest 4 |
| 5 | 1 | 14 | Quest 5 |
| 6 | 2 | 28 | Quest 6.1, 6.2 |
| 7 | 2 | 28 | Adventure 7.1, 7.2 |
| 8 | 3 | 42 | Adventure 8.1, 8.2, 8.3 |
| 9 | 3 | 42 | Adventure 9.1, 9.2, 9.3 |
| 10 | 2 | 28 | Hero 10.1, 10.2 |
| 11 | 3 | 42 | Hero 11.1, 11.2, 11.3 |
| 12 | 3 | 42 | Hero 12.1, 12.2, 12.3 |
| 13 | 2 | 28 | Legend 13.1, 13.2 |
| 14 | 3 | 42 | Legend 14.1, 14.2, 14.3 |
| 15 | 3 | 42 | Legend 15.1, 15.2, 15.3 |

Total books: 32
Total articles: 448

## Out of Scope for V1

- Full marketing analytics dashboards
- Multi-currency ledger
- Generic public campaign tooling beyond class-bound referral creation
- Non-local payment methods beyond Thai-focused launch needs
