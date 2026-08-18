-- Keep the sponsor graph acyclic at the database write boundary. The
-- transaction advisory lock makes two concurrent sponsor assignments observe
-- one another instead of both passing a read-then-write check.
CREATE OR REPLACE FUNCTION "identity"."prevent_sponsor_cycle"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cycle_found boolean;
BEGIN
  IF NEW."sponsor_tutor_id" IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(79231517);

  WITH RECURSIVE sponsor_chain("user_id", "sponsor_tutor_id", "path") AS (
    SELECT u."user_id", u."sponsor_tutor_id", ARRAY[u."user_id"]
    FROM "identity"."users" AS u
    WHERE u."user_id" = NEW."sponsor_tutor_id"
    UNION ALL
    SELECT u."user_id", u."sponsor_tutor_id", sc."path" || u."user_id"
    FROM "identity"."users" AS u
    JOIN sponsor_chain AS sc
      ON u."user_id" = sc."sponsor_tutor_id"
    WHERE NOT (u."user_id" = ANY(sc."path"))
  )
  SELECT EXISTS(
    SELECT 1 FROM sponsor_chain WHERE "user_id" = NEW."user_id"
  ) INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'SPONSOR_TREE_CYCLE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "users_prevent_sponsor_cycle"
BEFORE INSERT OR UPDATE OF "sponsor_tutor_id"
ON "identity"."users"
FOR EACH ROW
EXECUTE FUNCTION "identity"."prevent_sponsor_cycle"();
