# Chargeback protection — report for the owner (2026-10-22)

**Question:** can someone register many customers, collect commission, then
charge the payments back, leaving us to repay everything including the
commission we already paid out? Can we stop or limit it?

**Short answer:** before this change, **yes, and the system would not even have
noticed**. It is now fixed in code (branch `fix/chargeback-protection`, all
tests passing). A few settings need your decision and a few steps need Omise /
deployment (bottom of this page).

---

## 1. What was wrong

| # | Problem | Impact |
|---|---|---|
| 1 | **Chargebacks and refunds were invisible.** The code looked for the word "chargeback" in the event name, but Omise calls chargebacks *disputes* (`dispute.create` …). The refund/dispute data also does not carry our payment id, so the event was stored as "unknown" and ignored. | No clawback, student kept access, tutor still paid next month. |
| 2 | **No hold period.** Commission was paid on the 1st of the month after the payment (sometimes 1–2 days later), while a cardholder can charge back for months. | The scammer is paid before the chargeback arrives. |
| 3 | **Debts were wiped.** If a clawback was larger than the tutor's earnings, the rest was set to 0 and forgotten. Suspending a tutor also wiped their clawback. The upline's share was never reclaimed. | A scammer who stops working keeps the money; fake downlines keep the override. |
| 4 | **No automatic fraud detection.** The Risk page existed but nothing created alerts. No same-card check, no limit for new tutors. | One stolen card could pay for dozens of fake students. |
| 5 | A refunded payment could be re-activated by a late "paid" notification. | Free access after a refund. |

## 2. What we changed

1. **Chargebacks and refunds are detected** (webhook + a **daily automatic
   check with Omise** in case a webhook is missed). Each event is re-confirmed
   with Omise before anything changes.
   - Dispute opened → payment on hold, tutor flagged, **tutor payout paused**.
   - Dispute lost → student access removed. Dispute won → everything restored.
   - Partial refunds reduce the commission; full refunds remove access.
2. **Hold period before commission is paid:** card **60 days**, PromptPay
   **7 days** (adjustable). Most chargebacks happen inside 60 days, so for
   those **no commission ever leaves the company**.
3. **Automatic clawback** when commission was already paid — from the tutor
   **and the upline** — and **unpaid debts carry forward** to the next months
   until recovered (also for suspended tutors).
4. **Automatic fraud rules:**
   - a card that already charged back cannot be used again;
   - one card can pay for at most 3 different students (siblings are fine; the 4th is refused);
   - **new tutors (first 90 days) can take at most 30,000 THB of card payments per 30 days** — PromptPay unlimited. You can mark established teachers as "trusted" to remove the limit;
   - a tutor with a chargeback is flagged and their payout is **paused (not lost)** until an admin reviews it; the 2nd chargeback in 90 days = critical;
   - card payments without 3-D Secure are reported.

## 3. Example: the scam you described, now

A fake tutor registers 20 "students" and pays 3,000 THB each with stolen cards
(60,000 THB).

| | Before | Now |
|---|---|---|
| Card payments accepted | 20 | Max ~10 (30,000 THB new-tutor card limit); same card max 3 students |
| Commission paid out | ~62% at the next monthly payout (~37,200 THB; the rate rises with volume) | **0 for 60 days** |
| Chargebacks arrive (day 20–50) | not noticed; company repays 60,000 THB + fees and has already paid ~37,200 THB | detected; payments excluded; tutor payout paused after the first one; **no commission paid** |
| Loss | ~97,200 THB + dispute fees | chargeback amount + fees only (no commission left the company), on at most ~30,000 THB of card payments |

The chargeback itself still costs us the payment (that is how card networks
work). What we stopped is **paying commission on money that later disappears**.

## 4. Decisions (confirmed 2026-10-22)

1. **Hold period:** card 60 days / PromptPay 7 days — **confirmed**, set in
   the deployment config (`.github/workflows/deploy.yml`, repo variables can
   override without a code change).
2. **New tutor card limit:** 30,000 THB / 30 days for the first 90 days —
   **confirmed**. Admins mark established teachers as trusted with the new
   **"การรับชำระด้วยบัตร" card** on the tutor's verification page.
3. **Tutor communication:** the earnings page now explains the hold period;
   a ready-to-send announcement is in `docs/chargeback-protection-messages.md`.
4. **Tutor contract:** add a clause that commission on refunded or charged-back
   payments is recovered from future earnings.
5. **Network payout = classic differential (55.6% in the example below) —
   confirmed and implemented** (see section 7).

## 5. Steps before taking real payments

1. Deploy the branch (includes a database migration; tested on a fresh
   database: all 43 migrations apply and match the schema).
2. Omise dashboard → Webhooks: make sure `refund.create` and all `dispute.*`
   events are sent to our endpoint.
3. **Ask Omise to enforce 3-D Secure (OTP) for all cards.** For fraud
   chargebacks on 3DS-authenticated payments the liability usually moves to the
   card issuer.
4. Create the daily scheduler job (`infra/cloud-scheduler/dispute-sync-cron.yaml`).

## 6. Test results

- 26 new automated tests for this feature (disputes open/lost/won, refunds
  full/partial, upline clawback amounts, no double clawback, carry-forward,
  held payouts, card rules, new-tutor limit, 3DS flag, daily sync, end-to-end
  webhook).
- Whole project: **200 test files, 1,552 tests, all passing** (after the
  section 8 additions). TypeScript build of the finance service, admin console
  and tutor app: no errors. API contract check: OK.
- Database migration: applied to a fresh PostgreSQL 16 database (no drift);
  the backfill marks already-settled payments correctly so nobody is paid twice.

## 7. Network payout formula (fixed, owner decision 2026-10-22)

- **Before:** the formula subtracted only the *direct* children's own payout,
  so chains of 3+ levels were paid more than the top rate. Example: 3 tutors
  in a chain, 10,000 THB sales each (30,000 THB): the company paid about
  21,180 THB (70.6%).
- **Now (classic differential):** each tutor earns their rate on their group
  volume minus what their downline organisation already earns. The whole tree
  is paid exactly the rate of the top volume: **16,681.93 THB (55.6%)** in the
  same example (child 4,500 · middle 5,500 · top 6,681.93). A sponsor without
  own sales passes their share up to the next sponsor.
- Same formula in the settlement, the tutor earnings page, the network page
  and the clawback calculation (tests prove the clawback equals a full
  recalculation).

## 8. Added after the first report

- Admin console: "การรับชำระด้วยบัตร" card on the tutor verification page to
  trust / untrust a tutor (reason required, audited).
- Tutor app: the earnings page explains the hold period (values come from the
  server) and shows readable names for refund / chargeback / carry-forward
  adjustments.
- Deployment config sets the confirmed limits.
- Ready-to-send texts: tutor announcement (TH/EN) and Omise email (EN/TH) in
  `docs/chargeback-protection-messages.md`.
- Tests after these changes: **200 test files, 1,552 tests, all passing**;
  TypeScript (finance service, admin console, tutor app) and lint: no errors.

Technical details: `docs/runbooks/chargeback-protection.md`.
