-- Learning domain stub

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS learning.series (
  series_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  ra_level_start INT NOT NULL,
  ra_level_end INT NOT NULL,
  tagline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.books (
  book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES learning.series (series_id),
  level_number INT NOT NULL,
  book_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  article_count INT NOT NULL,
  class_hours INT,
  independent_hours INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.classes (
  class_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_user_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES learning.books (book_id),
  title TEXT NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  enrolled_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'full', 'closed')),
  starts_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.referrals (
  referral_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  class_id UUID NOT NULL REFERENCES learning.classes (class_id),
  tutor_user_id UUID NOT NULL,
  campaign_label TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES learning.classes (class_id),
  student_user_id UUID NOT NULL,
  referral_token TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'active', 'cancelled')),
  payment_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_classes_tutor_status
  ON learning.classes (tutor_user_id, status);

CREATE INDEX IF NOT EXISTS idx_learning_enrollments_student_status
  ON learning.enrollments (student_user_id, status);

-- Service ownership grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA learning TO svc_learning;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA learning TO svc_learning;
ALTER DEFAULT PRIVILEGES IN SCHEMA learning
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO svc_learning;
ALTER DEFAULT PRIVILEGES IN SCHEMA learning
  GRANT USAGE, SELECT ON SEQUENCES TO svc_learning;

COMMIT;
