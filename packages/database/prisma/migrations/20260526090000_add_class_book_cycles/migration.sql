CREATE TABLE "learning"."class_book_cycles" (
  "class_book_cycle_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "class_id" uuid NOT NULL,
  "book_id" uuid NOT NULL,
  "sequence" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'OPEN',
  "package_price_minor" bigint NOT NULL DEFAULT 250000,
  "opened_at" timestamptz NOT NULL DEFAULT now(),
  "closed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "class_book_cycles_pkey" PRIMARY KEY ("class_book_cycle_id"),
  CONSTRAINT "class_book_cycles_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "class_book_cycles_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "learning"."books"("book_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "class_book_cycles_class_id_book_id_key"
  ON "learning"."class_book_cycles"("class_id", "book_id");
CREATE UNIQUE INDEX "class_book_cycles_class_id_sequence_key"
  ON "learning"."class_book_cycles"("class_id", "sequence");
CREATE INDEX "class_book_cycles_class_id_status_idx"
  ON "learning"."class_book_cycles"("class_id", "status");

INSERT INTO "learning"."class_book_cycles" (
  "class_id",
  "book_id",
  "sequence",
  "status",
  "package_price_minor",
  "opened_at",
  "created_at",
  "updated_at"
)
SELECT
  "class_id",
  "book_id",
  1,
  'OPEN',
  "package_price_minor",
  "created_at",
  "created_at",
  "updated_at"
FROM "learning"."classes";

CREATE TABLE "learning"."enrollment_packages" (
  "enrollment_package_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "enrollment_id" uuid NOT NULL,
  "class_book_cycle_id" uuid NOT NULL,
  "student_user_id" uuid NOT NULL,
  "status" text NOT NULL,
  "payment_transaction_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "enrollment_packages_pkey" PRIMARY KEY ("enrollment_package_id"),
  CONSTRAINT "enrollment_packages_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "learning"."enrollments"("enrollment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "enrollment_packages_class_book_cycle_id_fkey" FOREIGN KEY ("class_book_cycle_id") REFERENCES "learning"."class_book_cycles"("class_book_cycle_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "enrollment_packages_enrollment_id_class_book_cycle_id_key"
  ON "learning"."enrollment_packages"("enrollment_id", "class_book_cycle_id");
CREATE INDEX "enrollment_packages_student_user_id_status_idx"
  ON "learning"."enrollment_packages"("student_user_id", "status");
CREATE INDEX "enrollment_packages_class_book_cycle_id_status_idx"
  ON "learning"."enrollment_packages"("class_book_cycle_id", "status");

INSERT INTO "learning"."enrollment_packages" (
  "enrollment_id",
  "class_book_cycle_id",
  "student_user_id",
  "status",
  "payment_transaction_id",
  "created_at",
  "updated_at"
)
SELECT
  e."enrollment_id",
  cbc."class_book_cycle_id",
  e."student_user_id",
  e."status",
  e."payment_transaction_id",
  e."created_at",
  e."updated_at"
FROM "learning"."enrollments" e
JOIN "learning"."class_book_cycles" cbc
  ON cbc."class_id" = e."class_id"
 AND cbc."sequence" = 1
WHERE e."status" IN ('ACTIVE', 'PENDING_PAYMENT');

ALTER TABLE "learning"."interactive_sessions"
  ADD COLUMN "class_book_cycle_id" uuid,
  ADD COLUMN "book_id" uuid;

UPDATE "learning"."interactive_sessions" s
SET "book_id" = c."book_id"
FROM "learning"."classes" c
WHERE s."class_id" = c."class_id"
  AND s."book_id" IS NULL;

UPDATE "learning"."interactive_sessions" s
SET "class_book_cycle_id" = cbc."class_book_cycle_id"
FROM "learning"."class_book_cycles" cbc
WHERE s."class_id" = cbc."class_id"
  AND cbc."sequence" = 1
  AND s."class_book_cycle_id" IS NULL;

CREATE INDEX "interactive_sessions_class_book_cycle_id_idx"
  ON "learning"."interactive_sessions"("class_book_cycle_id");
CREATE INDEX "interactive_sessions_book_id_idx"
  ON "learning"."interactive_sessions"("book_id");

ALTER TABLE "finance_mlm"."payment_intents"
  ADD COLUMN "enrollment_package_id" uuid;

CREATE INDEX "payment_intents_enrollment_package_id_idx"
  ON "finance_mlm"."payment_intents"("enrollment_package_id");
