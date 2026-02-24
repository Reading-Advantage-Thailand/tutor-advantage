# Tech Stack

Date: 2026-02-23

## Core Principles

- Backend domains are separated from day 1.
- One Cloud SQL Postgres cluster at launch, separate schemas per domain.
- REST APIs are the service contract.
- Web interfaces are separated into Tutor PWA and Student LIFF portal.

## Backend

- Language/runtime: TypeScript on Node.js
- API style: REST
- Services:
  - `identity-service`
  - `learning-service`
  - `finance-mlm-service`
- Database: Google Cloud SQL for PostgreSQL
- Schema layout:
  - `identity`
  - `learning`
  - `finance_mlm`
  - `legacy_bridge`

## Web and Mobile

- Admin finance console: Next.js (App Router)
- Tutor app: PWA (Progressive Web App)
- Student app: LINE LIFF (LINE Front-end Framework) web app
- **Offline/Caching Strategy:** Aggressive pre-caching via Service Workers for both PWA and LIFF to ensure fast loads of the active workbook, relying on 4G coverage rather than a fully native offline architecture.
- Next.js server functions/actions may be used as BFF helpers, but core business logic stays in backend services.

## Payments

- Gateway target: Omise
- Methods in scope:
  - PromptPay
  - Card payments (local-first launch configuration)

## Finance/MLM Engine Requirements

- Monthly settlement in ICT timezone.
- **Satang-based Ledger:** All values stored as Integers (Value * 100).
- High-precision internal decimal calculations (Decimal/Numeric) for intermediate steps.
- Final rounding only at tutor-period payout output.
- Refund/chargeback clawbacks in next settlement period.
- **Makers-Checkers Workflow:** Admin console must support two-party approval for manual overrides.

## Observability and Operations (V1 Minimum)

- Settlement run logs with immutable run IDs
- Payout approval audit trail
- **LINE OA Integration:** Hook for transactional messaging (Omise webhooks -> LINE notify).
- CSV export for accounting and reconciliation
- Error tracking and service health monitoring

## Security Baseline

- OAuth login: Tutors use Facebook + Google (PWA); Students exclusively use LINE Login (LIFF)
- Role-based authorization in backend services
- **PDPA Compliance:** Versioned consent tracking in `identity-service`.
- Guardian-required flow for underage students
- No cross-domain write access without explicit integration endpoint

## Future Evolution

- Move from shared cluster to separate DB instances per service if scaling or compliance requires.
- Add advanced analytics after core payment and settlement reliability is proven.
