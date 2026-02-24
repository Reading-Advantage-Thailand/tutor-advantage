# Tutor Advantage

Backend-first tutoring platform pivot for Thailand, with:

- student-pay class enrollment,
- tutor-led workbook classes,
- and automated monthly MLM settlement.

## Current Status

This repository is in transition.

- Legacy Next.js scaffold code is still present.
- New product direction and execution artifacts are tracked in `conductor/`.
- Implementation target is backend services first, then tutor mobile app, then student mobile app.

## Product Direction (Locked)

- Auth: Facebook + Google
- Payment model: student pays company (100% upfront)
- Payment rails: PromptPay + cards (Thai-local first)
- Referral model: tutor-generated class-bound links/QR codes
- Class ownership: tutor-only ownership in V1
- Communication: in-app chat is system of record; external channels only after consent
- MLM settlement: automated monthly run in ICT timezone, THB-only, finance approval before payout

## Target Architecture

Service-oriented backend from day 1:

- `identity-service`
- `learning-service`
- `finance-mlm-service`

Launch data strategy:

- One GCP Cloud SQL PostgreSQL cluster
- Separate schemas per service
- Strict service access boundaries

Client apps:

- Tutor app: native (Capacitor)
- Student app: native (Capacitor)
- Admin finance console: web (Next.js)

## Curriculum Program (Current Plan)

Series map:

| Series | CEFR | RA Levels | Tagline |
|---|---|---|---|
| Origins | A1 | 1-3 | Your journey starts here |
| Quest | A2 | 4-6 | Your quest awaits |
| Adventure | B1 | 7-9 | Your adventure's in sight |
| Hero | B2 | 10-12 | You're the hero in the story |
| Legend | C1 | 13-15 | Legendary stories |

Totals:

- 32 books
- 448 articles
- V1 release scope: Levels 1-6 (Origins + Quest)

## Legacy URL Compatibility

Printed workbook QR links must keep full URLs unchanged.
For unresolved legacy URLs, the system must render a graceful recovery/support page.

## Conductor Docs (Source of Truth)

- Index: `conductor/index.md`
- Product definition: `conductor/product.md`
- PRD: `conductor/prd.md`
- Market research: `conductor/market-research.md`
- Tech stack: `conductor/tech-stack.md`
- Workflow: `conductor/workflow.md`
- Active track: `conductor/tracks/backend_first_pivot_20260223/`

## Repository Layout

```text
.
├── conductor/              # Product and execution docs (authoritative)
├── src/                    # Legacy app scaffold (being replaced incrementally)
├── prisma/                 # Legacy schema and migrations
└── messages/               # Legacy localization files
```

## Development Notes

- Treat `conductor/` artifacts as canonical requirements/planning.
- Avoid adding new business logic to the legacy monolith unless required for transition safety.
- New implementation work should align to the active Conductor track plan.

## License

Proprietary - Tutor Advantage
