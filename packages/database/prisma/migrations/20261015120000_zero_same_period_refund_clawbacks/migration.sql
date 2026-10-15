-- Data fix (no schema change): refund/chargeback clawbacks created by the
-- payment webhook before same-period refunds became volume-only.
--
-- A clawback that sits in the payment's own (still open) settlement period
-- used to carry a commission amount as well as the volume reduction. The
-- settlement now counts the refunded payment and lets the adjustment remove
-- its volume, so that commission amount would deduct the refund twice.
-- Zero it for adjustments in runs that are not submitted/approved, and audit
-- each change. Later-period clawbacks and final runs are left untouched.

WITH fixed AS (
  UPDATE "finance_mlm"."adjustments" AS a
  SET "amount_minor" = 0
  FROM "finance_mlm"."settlement_runs" AS r,
       "finance_mlm"."payment_intents" AS p
  WHERE a."settlement_run_id" = r."settlement_run_id"
    AND a."created_by" = 'payment-webhook'
    AND a."reason" ~* '(refund|chargeback)'
    AND a."amount_minor" <> 0
    AND a."status" IN ('PENDING', 'APPROVED')
    AND r."status" IN ('DRAFT', 'ADJUSTMENT_PENDING', 'REJECTED')
    AND p."payment_intent_id"::text = substring(a."reason" from '([0-9a-fA-F-]{36})$')
    AND p."paid_at" IS NOT NULL
    AND to_char(p."paid_at" AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') = r."period_month"
  RETURNING a."adjustment_id", a."reason", r."period_month"
)
INSERT INTO "finance_mlm"."audit_events" ("actor_id", "action", "entity_type", "entity_id", "payload")
SELECT
  'migration:20261015120000',
  'ADJUST_CLAWBACK_ZEROED',
  'Adjustment',
  fixed."adjustment_id"::text,
  jsonb_build_object(
    'reason', fixed."reason",
    'periodMonth', fixed."period_month",
    'note', 'Same-period refund clawback made volume-only to avoid a double deduction'
  )
FROM fixed;
