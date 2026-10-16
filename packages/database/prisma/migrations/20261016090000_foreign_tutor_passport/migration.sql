-- Foreign tutors with a passport (phase 1).
-- Every existing tutor defaults to THAI_ID / RESIDENT, so nothing changes for
-- them; existing payout lines were all calculated at 3% as residents.

-- AlterTable
ALTER TABLE "identity"."users"
  ADD COLUMN "id_type" TEXT NOT NULL DEFAULT 'THAI_ID',
  ADD COLUMN "passport_number_enc" TEXT,
  ADD COLUMN "passport_number_last4" TEXT,
  ADD COLUMN "passport_nationality" TEXT,
  ADD COLUMN "passport_expires_on" DATE,
  ADD COLUMN "teaching_location" TEXT,
  ADD COLUMN "work_permit_image_url" TEXT,
  ADD COLUMN "work_permit_expires_on" DATE,
  ADD COLUMN "right_to_work_confirmed_at" TIMESTAMPTZ,
  ADD COLUMN "tax_residency" TEXT NOT NULL DEFAULT 'RESIDENT';

-- AlterTable
ALTER TABLE "finance_mlm"."payout_lines"
  ADD COLUMN "withholding_rate_percent" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "tax_residency" TEXT NOT NULL DEFAULT 'RESIDENT';
