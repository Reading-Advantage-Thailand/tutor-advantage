# Tutor Advantage

A backend-first tutoring ecosystem focused on the Thai market.

## Business Plan

- **Model:** Student-pay class enrollment tied to physical workbooks (~2500 THB).
- **Compensation:** MLM-based network tree and direct class sales for Tutors.
- **Platforms:** Web-first (PWA for Tutors, LINE LIFF portal exclusively for Students).
- **Payments:** Local Thai payments (Omise for PromptPay and local cards).
- **Settlement:** Automated monthly MLM settlement requiring manual finance approval before payouts.
- **Legacy Support:** Existing printed workbook QR links must remain fully functional.

## Developer Tasks

- **Service-Oriented Backend:** Build REST APIs using TypeScript/Node.js for `identity`, `learning`, and `finance-mlm` services.
- **Database:** Set up Google Cloud SQL (Postgres) with strict schema separation for each service.
- **Authentication:** Implement Facebook/Google OAuth for Tutors and LINE Login for Students.
- **Core Logic:** Build class creation, class-bound referral generation, and student enrollment flows.
- **Payment Integration:** Implement the student checkout flow using Omise webhooks.
- **Settlement Engine:** Build the MLM math engine using high-precision Satang (integer) calculations and monthly snapshotting.
- **Admin Console:** Develop a Next.js (App Router) portal for finance teams to approve payouts (Makers-Checkers workflow).
- **URL Preservation:** Build a compatibility bridge to resolve legacy QR code URLs exactly as they did before.

## Architecture & Source of Truth

- See `conductor/` directory for definitive product documentation, tech stack, and workflow.
- **Active Track:** `conductor/tracks/backend_first_pivot_20260223/`
