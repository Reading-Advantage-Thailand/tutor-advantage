ALTER TABLE "learning"."interactive_sessions"
    ADD COLUMN "current_phase" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "active_sentence_index" INTEGER,
    ADD COLUMN "phase_selected_indices" JSONB;
