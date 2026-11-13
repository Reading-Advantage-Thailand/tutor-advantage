-- Removed students in a live lesson (2026-11-07).
--  * session_participants.removed_at: set when the tutor removes a student from
--    the live room, cleared when that student joins again. A service instance
--    that rebuilds the room from the database skips these rows, so a removed
--    student no longer comes back as someone the class waits for.
--  * Nullable with no default: adding it rewrites nothing and existing rows read
--    as "not removed", so the migration is safe to apply ahead of the code.

-- AlterTable
ALTER TABLE "learning"."session_participants" ADD COLUMN "removed_at" TIMESTAMPTZ;
