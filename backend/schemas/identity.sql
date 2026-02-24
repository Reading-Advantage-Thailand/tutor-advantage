-- Identity domain stub

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS identity.users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('student', 'tutor', 'guardian', 'admin', 'finance')),
  display_name TEXT,
  email TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sponsor_tutor_id UUID,
  sponsor_locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_users_email_unique
  ON identity.users (LOWER(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS identity.oauth_identities (
  identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity.users (user_id),
  provider TEXT NOT NULL CHECK (provider IN ('facebook', 'google')),
  provider_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS identity.guardian_consents (
  consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES identity.users (user_id),
  guardian_user_id UUID REFERENCES identity.users (user_id),
  guardian_name TEXT NOT NULL,
  relation TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity.user_consents (
  user_consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity.users (user_id),
  consent_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service ownership grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO svc_identity;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity TO svc_identity;
ALTER DEFAULT PRIVILEGES IN SCHEMA identity
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO svc_identity;
ALTER DEFAULT PRIVILEGES IN SCHEMA identity
  GRANT USAGE, SELECT ON SEQUENCES TO svc_identity;

COMMIT;
