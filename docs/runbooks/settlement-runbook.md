# Runbook: Monthly Settlement

**Service:** `finance-mlm-service`  
**Owner:** Finance / Engineering  
**Audience:** On-call engineer, Finance Admin, Finance Checker

---

## Overview

On the **1st of each month at 00:05 ICT**, Google Cloud Scheduler calls  
`POST /v1/internal/settlement/auto-run` on the finance-mlm-service.  
This creates a **DRAFT** settlement run for the previous calendar month.

Finance Admin then reviews the payout lines and either **approves** or **rejects** the draft.  
On approval, WHT documents (Form 50 Tawi) are generated per payout line.

---

## Normal Monthly Flow

```
00:05 ICT, 1st of month
  │
  ▼
Cloud Scheduler → POST /v1/internal/settlement/auto-run
  │ X-Internal-Key: <INTERNAL_API_KEY>
  │
  ▼
SettlementService.previewSettlement(prevMonth, "SYSTEM_SCHEDULER")
  │ – aggregates PaymentIntents in [prev month ICT window]
  │ – maps payments → tutors via Enrollments
  │ – calculates MLM differential payout (bottom-up GV tree)
  │ – adds badge bonuses (ELITE_EDUCATOR +500 THB, TOP_RATED +300 THB, …)
  │ – deducts WHT at 3% on payout ≥ 1,000 THB
  │ – persists SettlementRun (status=DRAFT) + PayoutLines
  │
  ▼
Finance Admin reviews in admin-console → /settlements/<snapshotId>
  │ – checks gross volumes, payout rates, badge bonuses, WHT
  │ – exports CSV for spot-check
  │
  ▼
Finance Checker (≠ creator) approves
  │ POST /v1/settlements/:snapshotId/approve
  │ – enforces maker-checker (403 if same user as creator)
  │ – sets status=APPROVED
  │ – upserts PayoutDocuments (Form 50 Tawi) for each line
  │
  ▼
Finance team distributes payouts externally (bank transfer / payroll system)
```

---

## Trigger Conditions for Manual Intervention

| Symptom | Likely cause |
|---|---|
| No settlement run created by 01:00 ICT | Scheduler didn't fire / finance-mlm-service unhealthy |
| `DRAFT_EXISTS` error on auto-run | A draft already exists for that period (expected on retry) |
| `totalPayoutSatang` is 0 or unexpectedly low | No payments in period, or payment `updatedAt` outside window |
| A tutor is missing from payout lines | No active enrollments, or tutor's class had no successful payments |

---

## Step 1 — Check if the Scheduler fired

```bash
# In GCP Console → Cloud Scheduler → monthly-settlement-trigger
# Status column should show "Success" at ~00:05 on the 1st

# Or via CLI:
gcloud scheduler jobs describe monthly-settlement-trigger \
  --location=asia-southeast1 \
  --format="value(lastAttemptTime,status)"
```

Expected: `lastAttemptTime` within the last 24 h, `status = SUCCESS`.

---

## Step 2 — Check if the run exists in the DB

```sql
-- Connect to Cloud SQL via cloud-sql-proxy
SELECT settlement_run_id, period_month, status, created_at, created_by
FROM finance_mlm.settlement_runs
WHERE period_month = '2026-05'   -- ← replace with target month
ORDER BY created_at DESC
LIMIT 5;
```

| Outcome | Action |
|---|---|
| Row exists (status=DRAFT) | Normal — proceed to Finance review |
| Row exists (status=REJECTED) | Re-trigger manually (see Step 4) |
| No row | Trigger manually (see Step 4) |

---

## Step 3 — Check finance-mlm-service health

```bash
# Cloud Run
gcloud run services describe finance-mlm-service \
  --region=asia-southeast1 \
  --format="value(status.conditions[0].type, status.conditions[0].status)"

# Logs
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="finance-mlm-service"
   AND severity>=ERROR AND timestamp>="2026-05-01T00:00:00Z"' \
  --limit=20 --format=json | jq '.[].jsonPayload'
```

---

## Step 4 — Trigger settlement manually

```bash
# Replace <SERVICE_URL> and <INTERNAL_API_KEY> with values from Secret Manager
curl -X POST https://<SERVICE_URL>/v1/internal/settlement/auto-run \
  -H "X-Internal-Key: <INTERNAL_API_KEY>" \
  -H "Content-Type: application/json"
```

Expected response (first call):
```json
{ "message": "Settlement preview created successfully", "skipped": false, "settlementRunId": "..." }
```

If a draft already exists (idempotency):
```json
{ "message": "Settlement run already exists for this period — skipped", "skipped": true }
```

---

## Step 5 — Approve or reject the draft

Approval goes through the admin-console UI or directly:

```bash
# Approve (requires FINANCE_CHECKER role JWT, different user from creator)
curl -X POST https://<SERVICE_URL>/v1/settlements/<snapshotId>/approve \
  -H "Authorization: Bearer <CHECKER_JWT>"

# Reject (if the draft needs correction)
curl -X POST https://<SERVICE_URL>/v1/settlements/<snapshotId>/reject \
  -H "Authorization: Bearer <CHECKER_JWT>"
```

After rejection, fix the underlying data (manual adjustments) and re-trigger from Step 4.

---

## Rollback Procedure

> ⚠️ Only do this if the settlement run has **not** been approved (status=DRAFT or REJECTED).  
> Once status=APPROVED, payout documents exist — contact Finance Lead before deleting.

```sql
-- 1. Delete payout lines
DELETE FROM finance_mlm.payout_lines
WHERE settlement_run_id = '<snapshotId>';

-- 2. Delete the run
DELETE FROM finance_mlm.settlement_runs
WHERE settlement_run_id = '<snapshotId>';
```

Then re-trigger from Step 4.

---

## Escalation

1. **On-call engineer** → verify scheduler + service health (Steps 1–3)
2. **Finance Admin** → review and approve/reject draft (Step 5)
3. **Finance Lead** → approve manual deletions of APPROVED runs
4. **CTO** → if data integrity is in question

---

## Related

- [Payout Incident Response](./payout-incident-response.md)
- `services/finance-mlm-service/src/services/settlementService.ts`
- `infra/cloud-scheduler/settlement-cron.yaml`
