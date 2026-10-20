-- Book packages now default to 3,000 THB (300000 satang). Existing rows were
-- repriced directly; paid amounts stay on finance_mlm.payment_intents.
ALTER TABLE "learning"."classes" ALTER COLUMN "package_price_minor" SET DEFAULT 300000;
ALTER TABLE "learning"."class_book_cycles" ALTER COLUMN "package_price_minor" SET DEFAULT 300000;
