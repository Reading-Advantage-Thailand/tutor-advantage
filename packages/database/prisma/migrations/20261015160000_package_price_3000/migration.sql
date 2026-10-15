-- Default class package price ฿2,500 → ฿3,000 (2026-10-15). Only the column
-- defaults change: existing classes and book cycles keep the price they
-- were opened at (students and referral links already rely on it).

-- AlterTable
ALTER TABLE "learning"."classes" ALTER COLUMN "package_price_minor" SET DEFAULT 300000;

-- AlterTable
ALTER TABLE "learning"."class_book_cycles" ALTER COLUMN "package_price_minor" SET DEFAULT 300000;
