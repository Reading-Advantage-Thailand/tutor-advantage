# Specification: Backend-First Pivot Foundation

Track ID: `backend_first_pivot_20260223`
Date: 2026-02-23

## Overview

Rebuild the platform around backend services first, enabling:

- Student-pay class enrollment
- Tutor-created class-bound referral links and QR codes
- Automated monthly MLM settlement with finance approval before payout
- Full legacy article URL preservation for printed workbook QR continuity

This track establishes production-grade backend and admin finance foundations before the PWA and LIFF portal releases.

## Functional Requirements

### FR1. Service Boundaries

The system must provide separate backend services:

- `identity-service`
- `learning-service`
- `finance-mlm-service`

Each service exposes REST APIs and owns its domain model within separate Cloud SQL Postgres schemas.

### FR2. Authentication and Accounts

- Support Facebook and Google login for tutors (PWA). Support exclusive LINE Login for students (LIFF).
- Enforce guardian-required flows for underage users before payment/contact consent.
- Keep role models for tutor, student, guardian, and finance/admin operations.

### FR3. Class and Enrollment Flow

- Tutors create and own classes.
- Each class package maps to exactly one book (approx. 25 hours for ~2500 THB).
- Tutors schedule class hours on the system calendar based on client availability.
- Students enroll via class-bound referral link/QR.
- Payment is 100% upfront before enrollment activation.
- If class is closed/full, student sees other open classes from the same tutor with attribution preserved.

### FR4. Payment Processing

- Support Thai-local student-pay flow with PromptPay and cards via selected gateway integration.
- Checkout and payment processing occur exclusively within the student's LINE LIFF portal via Omise (PromptPay/Rabbit LINE Pay).
- Record successful payment as commissionable class sale event.
- Run THB-only financial records.

### FR5. MLM Settlement Engine

- Settlement cadence: monthly, ICT (UTC+7) calendar month.
- **Volume Metric:** The exact actual paid THB amount (post-discount) is the strict and only input for the MLM volume calculations. No artificial multipliers.
- Differential tree payout logic must support continuous rate function behavior defined by business.
- Activity eligibility: at least one individual course sale in the settlement month.
- Inactive nodes must be compressed in payout logic.
- Refund/chargeback adjustments must apply as clawbacks in the next settlement period.
- Payout release requires finance approval.

### FR6. Finance Operations Console

Provide admin console capabilities for:

- Settlement run preview
- Payout batch approval/reject
- Manual adjustment entry
- CSV export
- Immutable audit trail

### FR7. Legacy URL Compatibility

- Existing printed workbook URLs must remain fully unchanged.
- Unresolved legacy URLs must render graceful fallback page with recovery/support path.

## Non-Functional Requirements

1. Money movement and settlement outputs must be deterministic and replayable.
2. All payout-relevant calculations must use high-precision decimal arithmetic internally.
3. Rounding occurs only at final tutor-period payout output.
4. Domain boundaries must be enforced at API and database permission layers.
5. Every settlement/payout decision must be auditable with immutable records.

## Acceptance Criteria

1. Backend services are deployable and independently testable with REST contracts.
2. Student can complete class-bound referral flow to active enrollment only after successful payment.
3. Monthly settlement run produces reproducible tutor payout outputs for a fixed input dataset.
4. Finance user can preview, approve/reject, adjust, and export payout batches.
5. Refund in month N+1 correctly impacts month N+1 settlement via clawback.
6. Legacy printed URL routes resolve unchanged; unknown legacy URL shows graceful fallback.
7. No sponsor/upline changes are allowed after activation.

## Out of Scope

- Advanced marketing analytics dashboards
- Multi-currency support
- Public campaign management beyond class-bound referrals
- Tutor PWA/student LIFF portal UX implementation beyond backend contract needs in this track
