# Runbook: Payout Incident Response

**Service:** `finance-mlm-service`  
**Owner:** Engineering + Finance  
**Audience:** On-call engineer, Finance Lead

---

## Scope

This runbook covers three classes of payout incidents:

| ID | Type | Example |
|---|---|---|
| P1 | Over-payment | Tutor received more than calculated |
| P2 | Under-payment | Tutor received less than calculated |
| P3 | Duplicate payout | Same settlement run paid twice |

---

## Immediate Triage Checklist

1. Identify the affected `settlementRunId` and `tutorUserId`.
2. Check the payout line in the DB (see SQL below).
3. Determine if the settlement was APPROVED or still DRAFT.
4. Contact Finance Lead — **do not modify APPROVED records unilaterally**.
5. Open an incident ticket with: affected tutors, satang amounts, root cause hypothesis.

---

## Useful Queries

### Find payout line for a tutor in a given settlement

```sql
SELECT
  pl.payout_line_id,
  pl.tutor_user_id,
  pl.gross_volume_minor,
  pl.payout_rate,
  pl.payout_amount_minor,
  pl.badge_bonus_minor,
  pl.withholding_tax_minor,
  pl.net_payout_minor,
  pl.eligibility_status,
  sr.period_month,
  sr.status AS run_status,
  sr.approved_by,
  sr.approved_at
FROM finance_mlm.payout_lines pl
JOIN finance_mlm.settlement_runs sr USING (settlement_run_id)
WHERE sr.period_month = '2026-05'
  AND pl.tutor_user_id = '<tutorUserId>';
```

### Find all payments that contributed to a settlement period

```sql
-- ICT window for 2026-05: 2026-04-30 17:00 UTC → 2026-05-31 16:59:59 UTC
SELECT
  pi.payment_intent_id,
  pi.amount_minor,
  pi.status,
  pi.updated_at,
  e.class_id,
  c.tutor_user_id
FROM finance_mlm.payment_intents pi
JOIN learning.enrollments e USING (enrollment_id)
JOIN learning.classes c USING (class_id)
WHERE pi.status = 'SUCCESS'
  AND pi.updated_at >= '2026-04-30 17:00:00 UTC'
  AND pi.updated_at <  '2026-05-31 17:00:00 UTC'
  AND c.tutor_user_id = '<tutorUserId>';
```

### Find approved adjustments for a settlement period

```sql
SELECT *
FROM finance_mlm.adjustments a
JOIN finance_mlm.settlement_runs sr ON a.settlement_run_id = sr.settlement_run_id
WHERE sr.period_month = '2026-05'
  AND a.status = 'APPROVED'
  AND a.tutor_user_id = '<tutorUserId>';
```

---

## Incident Type P1 — Over-payment

**Possible causes:**
- A badge bonus was applied twice (duplicate `TutorBadge` record).
- An `Adjustment` with a large positive amount was incorrectly approved.
- The MLM differential calculation inflated the group volume.

**Steps:**
1. Compare `payout_amount_minor` against the expected value (manual recalculation).
2. Check `badge_bonus_minor` — cross-reference with `learning.tutor_badges` for the tutor.
3. Check the adjustment table for unexpected positive entries.
4. If overpayment is confirmed: create a **negative Adjustment** for the next settlement period.

```bash
# Create a clawback adjustment via the admin-console
# POST /v1/adjustments  (requires ADMIN role)
curl -X POST https://<SERVICE_URL>/v1/adjustments \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tutorUserId": "<tutorId>",
    "settlementRunId": "<nextMonthRunId>",
    "amountMinor": -<overPaymentSatang>,
    "reason": "clawback:over-payment:<incidentId>"
  }'
```

---

## Incident Type P2 — Under-payment

**Possible causes:**
- A payment's `updatedAt` was outside the settlement ICT window.
- The tutor's `isActive` flag was false at settlement time (excluded from `allUsers` query).
- A clawback adjustment over-corrected.

**Steps:**
1. Verify the payment timestamps (see query above) — check for off-by-one in UTC→ICT conversion.
2. Check `users.is_active = true` for the tutor.
3. Sum up all adjustments for the tutor in that period.
4. Calculate the delta: `expected - actual = compensationSatang`.
5. Create a **positive Adjustment** for the next settlement period (same flow as P1, positive amount).

---

## Incident Type P3 — Duplicate Payout

**Possible causes:**
- Cloud Scheduler retried and the idempotency check missed an existing APPROVED run.
- A manual re-trigger created a second draft for the same period.

**Steps:**
1. Find all settlement runs for the period:

```sql
SELECT settlement_run_id, status, created_at, created_by
FROM finance_mlm.settlement_runs
WHERE period_month = '2026-05'
ORDER BY created_at;
```

2. If two APPROVED runs exist for the same period, immediately alert Finance Lead.
3. Determine which run is correct (compare `preview_payload` totals).
4. The erroneous APPROVED run cannot be deleted without Finance Lead approval.  
   Instead, create offsetting negative adjustments in the next period for all affected tutors.

---

## Escalation Matrix

| Severity | Who to notify | SLA |
|---|---|---|
| Under ±1,000 THB total | Finance Admin only | Next business day |
| ±1,000–50,000 THB | Finance Lead + Engineering | Within 4 hours |
| > 50,000 THB | Finance Lead + CTO | Immediately |
| Duplicate APPROVED run | Finance Lead + CTO + Legal | Immediately |

---

## Post-Incident

After resolution:
1. Add a manual audit note in the `audit_events` table.
2. Update the incident ticket with root cause and remediation.
3. If the root cause is a code bug, file a bug report and add a regression unit test.

---

## Related

- [Settlement Runbook](./settlement-runbook.md)
- `services/finance-mlm-service/src/services/settlementService.ts`
- `services/finance-mlm-service/src/controllers/adjustmentController.ts`
