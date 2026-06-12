ALTER TABLE "learning"."classes" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "learning"."classes" ADD COLUMN "expires_at" TIMESTAMPTZ;
