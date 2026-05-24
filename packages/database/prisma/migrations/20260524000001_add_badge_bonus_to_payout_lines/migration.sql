-- AlterTable: add badge_bonus_minor to payout_lines for gamification bonus tracking
ALTER TABLE "finance_mlm"."payout_lines"
  ADD COLUMN "badge_bonus_minor" BIGINT NOT NULL DEFAULT 0;
