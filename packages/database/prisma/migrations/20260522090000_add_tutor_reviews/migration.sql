CREATE TABLE "learning"."tutor_reviews" (
    "review_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutor_user_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_reviews_pkey" PRIMARY KEY ("review_id"),
    CONSTRAINT "tutor_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "tutor_reviews_student_user_id_class_id_key"
    ON "learning"."tutor_reviews"("student_user_id", "class_id");

CREATE INDEX "tutor_reviews_tutor_user_id_idx"
    ON "learning"."tutor_reviews"("tutor_user_id");

CREATE INDEX "tutor_reviews_class_id_idx"
    ON "learning"."tutor_reviews"("class_id");

ALTER TABLE "learning"."tutor_reviews"
    ADD CONSTRAINT "tutor_reviews_tutor_user_id_fkey"
    FOREIGN KEY ("tutor_user_id") REFERENCES "identity"."users"("user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "learning"."tutor_reviews"
    ADD CONSTRAINT "tutor_reviews_student_user_id_fkey"
    FOREIGN KEY ("student_user_id") REFERENCES "identity"."users"("user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "learning"."tutor_reviews"
    ADD CONSTRAINT "tutor_reviews_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "learning"."classes"("class_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
