-- Phase 1 scaffold: schemas and role boundaries
-- Apply in privileged context.

BEGIN;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS learning;
CREATE SCHEMA IF NOT EXISTS finance_mlm;
CREATE SCHEMA IF NOT EXISTS legacy_bridge;

-- Service roles (replace with managed identities/secrets by environment)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_identity') THEN
    CREATE ROLE svc_identity LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_learning') THEN
    CREATE ROLE svc_learning LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'svc_finance_mlm') THEN
    CREATE ROLE svc_finance_mlm LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA identity TO svc_identity;
GRANT USAGE ON SCHEMA learning TO svc_learning;
GRANT USAGE ON SCHEMA finance_mlm TO svc_finance_mlm;

-- No cross-schema write grants by default.
-- Service grants for tables/sequences are finalized after domain DDL is applied.

COMMIT;
