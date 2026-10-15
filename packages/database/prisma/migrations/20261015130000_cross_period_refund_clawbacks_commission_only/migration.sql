-- Data fix (no schema change), owner decision 2026-10-15: a refund or
-- chargeback clawback that lands in a later period than the payment reclaims
-- only the commission paid; it no longer lowers the later period's volume.
-- Clear volume_minor on such webhook adjustments in runs that are still
-- open, and audit each change. Final runs are untouched.

WITH fixed AS (
  UPDATE "finance_mlm"."adjustments" AS a
  SET "volume_minor" = 0
  FROM "finance_mlm"."settlement_runs" AS r,
       "finance_mlm"."payment_intents" AS p
  WHERE a."settlement_run_id" = r."settlement_run_id"
    AND a."created_by" = 'payment-webhook'
    AND a."reason" ~* '(refund|chargeback)'
    AND COALESCE(a."volume_minor", 0) <> 0
    AND a."status" IN ('PENDING', 'APPROVED')
    AND r."status" IN ('DRAFT', 'ADJUSTMENT_PENDING', 'REJECTED')
    AND p."payment_intent_id"::text = substring(a."reason" from '([0-9a-fA-F-]{36})$')
    AND p."paid_at" IS NOT NULL
    AND to_char(p."paid_at" AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') <> r."period_month"
  RETURNING a."adjustment_id", a."reason", r."period_month"
)
INSERT INTO "finance_mlm"."audit_events" ("actor_id", "action", "entity_type", "entity_id", "payload")
SELECT
  'migration:20261015130000',
  'ADJUST_CLAWBACK_VOLUME_CLEARED',
  'Adjustment',
  fixed."adjustment_id"::text,
  jsonb_build_object(
    'reason', fixed."reason",
    'periodMonth', fixed."period_month",
    'note', 'Cross-period refund clawback made commission-only'
  )
FROM fixed;
