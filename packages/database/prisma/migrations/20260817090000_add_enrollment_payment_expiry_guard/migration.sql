ALTER TABLE "learning"."enrollments"
  ADD COLUMN "payment_expires_at" TIMESTAMPTZ;

UPDATE "learning"."enrollments"
SET "payment_expires_at" = "created_at" + INTERVAL '30 minutes'
WHERE "status" = 'PENDING_PAYMENT'
  AND "payment_expires_at" IS NULL;

-- Keep the oldest open enrollment for each student/class pair before adding
-- the partial unique index. Older deployments did not enforce this pair.
WITH ranked AS (
  SELECT
    "enrollment_id",
    "class_id",
    ROW_NUMBER() OVER (
      PARTITION BY "class_id", "student_user_id"
      ORDER BY "created_at", "enrollment_id"
    ) AS row_number
  FROM "learning"."enrollments"
  WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE')
), duplicates AS (
  SELECT "enrollment_id", "class_id"
  FROM ranked
  WHERE row_number > 1
), duplicate_counts AS (
  SELECT "class_id", COUNT(*)::integer AS duplicate_count
  FROM duplicates
  GROUP BY "class_id"
)
UPDATE "learning"."classes" AS classes
SET "enrolled_count" = GREATEST(0, classes."enrolled_count" - duplicate_counts.duplicate_count)
FROM duplicate_counts
WHERE classes."class_id" = duplicate_counts."class_id";

WITH ranked AS (
  SELECT
    "enrollment_id",
    ROW_NUMBER() OVER (
      PARTITION BY "class_id", "student_user_id"
      ORDER BY "created_at", "enrollment_id"
    ) AS row_number
  FROM "learning"."enrollments"
  WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE')
)
UPDATE "learning"."enrollment_packages" AS packages
SET "status" = 'CANCELLED'
WHERE packages."status" = 'PENDING_PAYMENT'
  AND packages."enrollment_id" IN (
    SELECT "enrollment_id"
    FROM ranked
    WHERE row_number > 1
  );

WITH ranked AS (
  SELECT
    "enrollment_id",
    ROW_NUMBER() OVER (
      PARTITION BY "class_id", "student_user_id"
      ORDER BY "created_at", "enrollment_id"
    ) AS row_number
  FROM "learning"."enrollments"
  WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE')
)
UPDATE "learning"."enrollments"
SET "status" = 'CANCELLED', "payment_expires_at" = NULL
WHERE "enrollment_id" IN (
  SELECT "enrollment_id"
  FROM ranked
  WHERE row_number > 1
);

CREATE INDEX "enrollments_class_id_status_payment_expires_at_idx"
  ON "learning"."enrollments"("class_id", "status", "payment_expires_at");

CREATE UNIQUE INDEX "enrollments_active_student_class_key"
  ON "learning"."enrollments"("class_id", "student_user_id")
  WHERE "status" IN ('PENDING_PAYMENT', 'ACTIVE');
