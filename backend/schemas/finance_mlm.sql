-- Finance and MLM domain stub

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS finance_mlm.payment_intents (
  payment_intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency = 'THB'),
  method TEXT NOT NULL CHECK (method IN ('promptpay', 'card')),
  status TEXT NOT NULL CHECK (status IN ('requires_action', 'pending', 'succeeded', 'failed', 'refunded', 'charged_back')),
  idempotency_key TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_payment_intents_idempotency
  ON finance_mlm.payment_intents (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS finance_mlm.payment_events (
  payment_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID REFERENCES finance_mlm.payment_intents (payment_intent_id),
  event_type TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_mlm.settlement_runs (
  settlement_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected', 'exported')),
  preview_payload JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS finance_mlm.payout_lines (
  payout_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_run_id UUID NOT NULL REFERENCES finance_mlm.settlement_runs (settlement_run_id),
  tutor_user_id UUID NOT NULL,
  gross_volume_minor BIGINT NOT NULL,
  payout_rate NUMERIC(12,8) NOT NULL,
  payout_amount_minor BIGINT NOT NULL,
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('eligible', 'ineligible')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_mlm.adjustments (
  adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_run_id UUID NOT NULL REFERENCES finance_mlm.settlement_runs (settlement_run_id),
  tutor_user_id UUID NOT NULL,
  amount_minor BIGINT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_mlm.audit_events (
  audit_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_settlement_period
  ON finance_mlm.settlement_runs (period_month, status);

CREATE INDEX IF NOT EXISTS idx_finance_audit_entity
  ON finance_mlm.audit_events (entity_type, entity_id, created_at DESC);

-- Service ownership grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finance_mlm TO svc_finance_mlm;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finance_mlm TO svc_finance_mlm;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_mlm
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO svc_finance_mlm;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance_mlm
  GRANT USAGE, SELECT ON SEQUENCES TO svc_finance_mlm;

COMMIT;
