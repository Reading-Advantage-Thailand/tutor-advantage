-- One-time admin invites for top-level tutors (no upline).

-- CreateTable
CREATE TABLE "identity"."tutor_invites" (
    "tutor_invite_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "used_by_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_invites_pkey" PRIMARY KEY ("tutor_invite_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tutor_invites_token_hash_key" ON "identity"."tutor_invites"("token_hash");
