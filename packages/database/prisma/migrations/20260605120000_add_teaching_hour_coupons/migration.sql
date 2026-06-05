-- Coupon feature: admin-issued teaching-hour coupons redeemed by tutors

ALTER TABLE "learning"."classes"
  ADD COLUMN "free_hours" integer NOT NULL DEFAULT 0;

CREATE TABLE "learning"."teaching_hour_coupons" (
  "coupon_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "hours" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "note" text,
  "created_by_user_id" uuid NOT NULL,
  "assigned_tutor_id" uuid,
  "redeemed_by_tutor_id" uuid,
  "redeemed_class_id" uuid,
  "redemption_mode" text,
  "redeemed_at" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "teaching_hour_coupons_pkey" PRIMARY KEY ("coupon_id")
);

CREATE UNIQUE INDEX "teaching_hour_coupons_code_key"
  ON "learning"."teaching_hour_coupons"("code");
CREATE INDEX "teaching_hour_coupons_status_idx"
  ON "learning"."teaching_hour_coupons"("status");
CREATE INDEX "teaching_hour_coupons_assigned_tutor_id_idx"
  ON "learning"."teaching_hour_coupons"("assigned_tutor_id");
CREATE INDEX "teaching_hour_coupons_redeemed_by_tutor_id_idx"
  ON "learning"."teaching_hour_coupons"("redeemed_by_tutor_id");
