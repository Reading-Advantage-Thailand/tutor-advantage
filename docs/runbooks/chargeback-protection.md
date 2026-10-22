# Chargeback protection (refunds, disputes, clawbacks)

Added 2026-10-22 (branch `fix/chargeback-protection`). Protects the company
against the "register customers, get commission, charge back" scam.

## How money flows now

1. **Payment succeeds.** Nothing is paid to tutors yet.
2. **Hold period.** The payment's commission is counted only in the first
   monthly settlement after the hold ends: **card 60 days, PromptPay 7 days**
   (`PAYOUT_HOLD_DAYS_CARD`, `PAYOUT_HOLD_DAYS_OTHER`). Most chargebacks arrive
   inside 60 days, so their commission is never paid out.
3. **Settlement approval** stamps every paid payment with the run
   (`payment_intents.commission_settlement_run_id`). A stamped payment is never
   counted again; an unstamped one that missed its month (e.g. a dispute that
   was won later) is picked up by the next settlement automatically.
4. **Refund / chargeback after payout** → automatic clawback (see below).

## What happens on each Omise event

Omise chargebacks are **disputes** (`dispute.create/update/accept/close`);
refunds are `refund.create`. Their payload is a dispute / refund object that
only points at the charge (`data.charge`). Every event is re-fetched from
Omise and matched to the stored payment (charge id, amount, currency,
`metadata.paymentIntentId`) before anything changes.

| Event | Payment status | Student access | Money |
|---|---|---|---|
| dispute opened (`open`/`pending`) | `DISPUTED` (excluded from settlement) | kept | clawback if commission already paid; tutor gets a `CHARGEBACK` flag (payout paused) |
| dispute lost (`lost`, `dispute.accept`) | `CHARGEBACKED` | revoked | clawback (idempotent with the one above) |
| dispute won | back to `SUCCESS` | kept | earlier clawback reversed as **PENDING** credits (finance approves) |
| partial refund | stays `SUCCESS`, `refunded_amount_minor` updated | kept | settlement volume reduced; clawback of the refunded part if already paid |
| full refund | `REFUNDED` | revoked | clawback if already paid |

A late "paid" notification can never re-activate a `REFUNDED`,
`CHARGEBACKED` or `DISPUTED` payment.

**Daily safety net:** `POST /v1/internal/payments/sync-disputes`
(`X-Internal-Key`, Cloud Scheduler `infra/cloud-scheduler/dispute-sync-cron.yaml`,
06:15 ICT) pulls the last 45 days of disputes and refunds from Omise and
re-checks every open dispute. Safe to run any time (idempotent).

## Clawback rules

- Only for payments whose commission was already paid (stamped).
- Estimated from the approved run: the tutor's group volume is reduced by the
  lost amount and the payout formula is re-applied **up the sponsor chain**,
  so the upline's override is clawed back too. Nobody is charged more than
  they were paid.
- Written as **APPROVED** negative adjustments (reason
  `refund|chargeback:<paymentIntentId>:<omiseId>:<tutorId>`, `volumeMinor = 0`)
  in the first open run after the paid run.
- **Carry-forward:** if a tutor owes more than they earn in a month, the
  negative balance is moved to the next month on approval
  (`carry-forward:<runId>:<tutorId>`) until it is recovered. Debts of
  suspended / unverified tutors are kept too (previously they were wiped).

## Automatic fraud rules (Risk page)

| Flag | Severity | When | Effect |
|---|---|---|---|
| `CHARGEBACK` | HIGH (CRITICAL from the 2nd dispute in 90 days) | dispute on a tutor's payment | **payout held** |
| `CARD_BLOCKED` | HIGH | a card that already had a chargeback is used again | card refused; payout held |
| `MULTI_ACCOUNT` | MEDIUM at 3 students per card, HIGH at the 4th | same card fingerprint, many students | 4th student refused; HIGH = payout held |
| `VELOCITY` | MEDIUM | new tutor (< 90 days) over 30,000 THB card sales in 30 days | card refused, PromptPay offered |
| `CARD_NO_3DS` | LOW | card paid without 3-D Secure | information only |

**Held payout:** a tutor with a HIGH/CRITICAL flag in `OPEN`, `INVESTIGATING`
or `FROZEN` gets a `HELD_FRAUD_REVIEW` line (nothing paid, no tax slip). On
approval the amount is carried to next month (`held-carry-forward:...`), so
it is paid as soon as an admin sets the flag to `MONITORING` or `CLEARED`.
Clawbacks are netted against it first.

**Trusted tutors:** an admin can exempt an established tutor from the
new-tutor card limit in the admin console: Users → tutor → Verification tab →
card **"การรับชำระด้วยบัตร"** → "ตั้งเป็นครูที่เชื่อใจ" (reason required,
audited). API: `PATCH /v1/users/:id/card-payments-trust`
`{ "trusted": true, "reason": "..." }` (ADMIN), or list ids in
`RISK_CARD_TRUSTED_TUTOR_IDS`.

**Tutor app:** the earnings page shows a notice with the hold days (from
`GET /v1/tutors/earnings/history` → `payoutPolicy`) and readable names for
`refund:` / `chargeback:` / `carry-forward:` adjustments.

## Network payout formula (classic differential, 2026-10-22)

`Payout(node) = max(0, R(GV) * GV - total paid in each child's organisation)`.
The tree is paid exactly `R(GV_root) * GV_root`; a node without own sales
(`INELIGIBLE_NO_PV`) passes its share up. Implemented identically in
`settlementService.computeSettlement`, `tutorEarningsController`,
`tutorNetworkController` and `clawbackService`.

## Settings (environment variables, finance-mlm-service)

Set on every deploy by `.github/workflows/deploy.yml` (confirmed values;
override with GitHub repository variables of the same name).

| Variable | Default | Meaning |
|---|---|---|
| `PAYOUT_HOLD_DAYS_CARD` | 60 | hold before card commission is paid |
| `PAYOUT_HOLD_DAYS_OTHER` | 7 | hold for PromptPay / other |
| `RISK_MAX_STUDENTS_PER_CARD` | 3 | students per card; the next one is refused |
| `RISK_NEW_TUTOR_DAYS` | 90 | tutor account age counted as "new" |
| `RISK_NEW_TUTOR_CARD_LIMIT_THB` | 30000 | card sales per 30 days for a new tutor |
| `RISK_CARD_TRUSTED_TUTOR_IDS` | (empty) | comma-separated exempt tutor ids |
| `RISK_DISPUTE_WINDOW_DAYS` | 90 | window for dispute escalation |
| `OMISE_VAULT_BASE_URL` | https://vault.omise.co | token lookup (card fingerprint before charging) |

## Deployment checklist

1. Run the migration `20261022120000_chargeback_protection` (adds 4 columns +
   backfills `commission_settlement_run_id` for payments already settled by
   APPROVED runs, so nothing is paid twice).
2. Omise dashboard → Webhooks: endpoint receives `refund.create` and all
   `dispute.*` events (in addition to `charge.*`).
3. Ask Omise support to **enforce 3-D Secure for all card payments**
   (shifts fraud chargeback liability to the card issuer).
4. Create the daily scheduler job (`dispute-sync-cron.yaml`).
5. Tell tutors: commission for a payment is paid in the monthly run after the
   hold (card ~2 months, PromptPay ~1 week). PromptPay is paid fastest.

## Code map

- `services/payoutPolicy.ts` hold days, settlement payment selection, risk settings
- `services/paymentRiskService.ts` dispute / refund handling, daily sync
- `services/clawbackService.ts` clawback estimate, clawback and reversal adjustments
- `services/fraudRules.ts` automatic flags, card checks, payout hold list
- `services/adjustmentRunService.ts` "first open run" helper
- `services/settlementService.ts` hold period, held lines, carry-forward, stamping
- `controllers/paymentController.ts` webhook routing, card checks before charging
- `controllers/riskController.ts` daily sync endpoint, card-trust endpoint
- Tests: `services/chargebackProtection.test.ts`
