# Backup and disaster recovery (Cloud SQL, secrets, buckets)

Written 2026-11-05 after a real restore drill and a cutover test (see
[Drill log](#drill-log)). Covers how Tutor Advantage data is backed up, how
to restore it **without touching the other products on the same instance**,
and what to reconcile afterwards. Read "Before you restore" completely before
running anything.

| | |
|---|---|
| Database | `tutor_advantage` (schemas `identity`, `learning`, `finance_mlm`; migration history in `public._prisma_migrations`; owner `cloudsqlsuperuser`) on the **shared** Cloud SQL instance `cloud-sql` (`reading-advantage:asia-southeast1:cloud-sql`, PostgreSQL 17, `db-g1-small`, zonal) |
| Who connects | identity-service, learning-service, finance-mlm-service, admin-console and the job `tutor-advantage-db-migrate`, all as `postgres` through secret `ta-database_url` |
| Automated backups | daily, window opens 17:00 UTC (00:00 ICT), 7 kept, stored in multi-region `asia`, kept after instance deletion (`retainBackupsOnDelete`) |
| Point-in-time recovery | enabled with 7 days of WAL, **but a PITR clone currently fails** (see [Known gaps](#known-gaps)) |
| Deletion protection | on for `cloud-sql` |
| RPO (worst case today) | up to ~24 h (last daily backup), because PITR cannot be used until the network gap is fixed |
| RTO (measured) | ~15 min of Cloud SQL work for a per-database restore, plus freeze, smoke tests and reconciliation; plan for 1–2 h |
| Not a backup | `npm run db:clone:local` (`local-production-clone.md`) is anonymized and remapped; it cannot be restored to production |

## The one rule: never restore over `cloud-sql`

`cloud-sql` holds **11 databases from several products**: `tutor_advantage`,
`reading_advantage` (our lesson content, read-only for us),
`primary_advantage`, `primary_v2`, `accounting`, `marketing`,
`sales_advantage`, `codecamp_advantage` and `company_identity`, plus `postgres`
and Prisma shadow DBs. Cloud SQL backups and PITR work on the **whole
instance**.

- `gcloud sql backups restore … --restore-instance=cloud-sql` would roll back
  **every product** to the backup time. Never run a restore with
  `--restore-instance=cloud-sql`.
- Always restore into a **new scratch instance**, then copy only
  `tutor_advantage` back. The steps are export, import under a temporary
  name, then swap the database names. The database name and the secret never
  change.
- A whole-instance restore is only for the case where the instance is gone
  (Path B). It needs the other product owners (the Reading Advantage and
  Primary Advantage teams) on the call.

## Which path

| Situation | Path |
|---|---|
| Bad data or a bad migration in `tutor_advantage`, instance healthy | **A**: per-database restore and name swap |
| A few rows or tables deleted or corrupted, rest of the DB fine | **C**: restore to scratch, copy the rows back |
| `cloud-sql` deleted, unrecoverable or region down | **B**: restore a backup to a new instance and repoint (not drilled) |
| Cloud SQL only unavailable (all backends fail `/health`) | Not DR. Check Cloud SQL status first (`monitoring-alerts.md`, "Service down") |
| A secret was deleted or overwritten | [Secrets and runtime config](#secrets-and-runtime-config) |
| KYC documents deleted | [Buckets](#buckets) (7-day soft delete) |

Escalation follows `settlement-runbook.md`: on-call engineer, then the
Finance Lead (any money table involved), then the CTO "if data integrity is in
question". A restore that removes or duplicates an APPROVED settlement run is
the "duplicate APPROVED run" severity in `payout-incident-response.md`
(Finance Lead + CTO + Legal).

## Before you restore (all paths)

Do these in order and write every timestamp down **in UTC**. Use Git Bash or
Cloud Shell. Every block below starts with the variables it needs; set them
again in every new shell.

```bash
export P=reading-advantage R=asia-southeast1
export D=$(date -u +%Y%m%d)          # incident date, used in scratch names
: "${P:?}" "${R:?}" "${D:?}"
```

1. **Announce** in the team channel and in the TA ops alert channel in Discord
   (the channel behind secret `ta-discord-webhook-url`, see
   `monitoring-alerts.md`). Say what happened, when the damage probably
   started, and that a restore is starting, so nobody rolls back revisions or
   reopens ingress mid-restore. App errors will post in that channel during
   the freeze. (`ta-monitoring` is the support-ticket channel, not the alert
   channel.)
2. **Snooze the monitoring policies** for the window: Cloud Console →
   Monitoring → Alerting → Snooze, all `TA:` policies (`monitoring-alerts.md`,
   "Silencing").
3. **Pause the Tutor Advantage scheduler jobs.** Take names from the live
   list, not from `infra/cloud-scheduler/*.yaml`, which has drifted before:
   ```bash
   gcloud scheduler jobs list --location=$R --project=$P --filter='name~/jobs/ta-' \
     --format='value(name.basename(),state)'
   for j in ta-class-session-reminders ta-book-payment-reminders ta-daily-dispute-sync ta-ticket-overdue-digest; do
     gcloud scheduler jobs pause "$j" --location=$R --project=$P
   done
   ```
   If the list shows another `ta-` job, pause it too. Leave the other
   products' jobs alone (`generate-stories`, `Refresh_AI_insights`,
   `refresh-views`, …). Settlement is manual: tell Finance not to preview,
   approve or send any settlement until Reconcile is signed off.
4. **Freeze deploys.** Every successful push to `main` runs `deploy.yml`.
   That runs `tutor-advantage-db-migrate` against whatever database is live
   and redeploys the services, and internal ingress does not stop it. Disable
   the workflow (GitHub → Actions → "Deploy" → ··· → Disable workflow, or
   `gh workflow disable deploy.yml --repo Reading-Advantage-Thailand/tutor-advantage`),
   make sure no run is in progress, and tell the team not to merge until
   Reconcile is signed off.
5. **Freeze writes.** Every write to `tutor_advantage` comes from
   identity-service, learning-service, finance-mlm-service and admin-console
   (Google login callback). Cut them off from the internet:
   ```bash
   for s in identity-service learning-service finance-mlm-service admin-console; do
     gcloud run services update "$s" --region=$R --project=$P --ingress=internal
   done
   ```
   Omise webhooks now fail and Omise retries them for a while. That is
   intended: they are processed again after the restore. LINE webhooks only
   reply with a link and are safe to lose.
6. **Take a forensic backup of the damaged state** before anything else. It
   is the only copy of rows written between the restore point and now
   (discount-code redemptions, tickets, sign-ups, payments, fraud flags):
   ```bash
   gcloud sql backups create --instance=cloud-sql --project=$P \
     --description="ta-forensic-$D before tutor_advantage restore"
   ```
   This snapshots the whole instance but changes nothing for the other
   products. In Path A the damaged database itself is also kept, under a new
   name, until sign-off.
7. **Choose the restore point.**
   - Daily backup (works today). `windowStartTime` is only when the backup
     window opens; the snapshot itself can run later. Pick the newest
     **AUTOMATED, SUCCESSFUL** backup whose `endTime` is before the damage
     started, and never the `ta-forensic-*` backup from step 6:
     ```bash
     gcloud sql backups list --instance=cloud-sql --project=$P --limit=10 \
       --filter='type=AUTOMATED AND status=SUCCESSFUL' \
       --format='table(id,startTime,endTime,windowStartTime)'
     ```
     If you cannot rule out that the damage happened before that backup's
     `endTime`, use the backup before it.
   - PITR to an exact second is possible only after the network gap is fixed
     (Known gap 1). Then
     `gcloud sql instances clone cloud-sql ta-dr-$D --point-in-time=<UTC ISO> --project=$P`
     replaces A1–A2.
8. **Check the code/schema gap.** If the restore point is older than the
   newest migration in `packages/database/prisma/migrations`, the running
   images expect tables the restored DB does not have. A7 fixes this after the
   swap (A6), except when the damage was itself a migration: then follow A7's
   first bullet. Do not reopen traffic (A10) before A7 has succeeded.

## Path A: per-database restore and name swap

The restored copy is imported under a temporary name. Then the names are
swapped inside `cloud-sql`: the damaged database becomes
`tutor_advantage_damaged_$D`, and the restored one becomes `tutor_advantage`.
Because the name stays `tutor_advantage`:
- `ta-database_url` never changes and no service needs reconfiguring;
- `db:clone:local` keeps working;
- a rollback is just the reverse rename.

This was tested on Cloud SQL as `postgres` on 2026-11-05 (see the drill log).

**A1. Create a scratch instance** (about 4.5 min). It gets a **public IP
only**, because a new instance on `sql-connect-vpc` cannot be created today
(Known gap 1). `--labels` is not accepted by this command. Use a bigger
`--storage-size` if `cloud-sql` has grown, since the target must not be
smaller than the source disk.
```bash
gcloud sql instances create ta-dr-$D --project=$P \
  --database-version=POSTGRES_17 --edition=ENTERPRISE --tier=db-g1-small \
  --region=$R --storage-type=SSD --storage-size=10 \
  --no-backup --availability-type=zonal --assign-ip
```

**A2. Restore the chosen backup into it** (about 5 min). `--restore-instance`
must be the **scratch** instance.
```bash
BACKUP_ID=<id from step 7>
gcloud sql backups restore "$BACKUP_ID" --project=$P \
  --backup-instance=cloud-sql --restore-instance=ta-dr-$D
```
The scratch instance now holds every product's databases and users as of the
backup. Treat it as production PII: no local dumps, and delete it at the end.

**A3. Verify the restored copy.** Connect through the proxy on a port that
cannot be mistaken for production (never `5432`, which is the local prod
proxy by convention):
```bash
./cloud-sql-proxy.exe --token "$(gcloud auth print-access-token)" \
  "$P:$R:ta-dr-$D?port=5440" --address 127.0.0.1
```
The credentials are those in `ta-database_url` (the same users as
production). Read the secret into a variable and never print it. The password
contains characters, such as a backslash, that break JavaScript's
`new URL()`, so parse it by hand if you script this. Check at least:
- `select count(*), max(migration_name) from public._prisma_migrations`;
- the row counts of `identity.users`, `finance_mlm.payment_intents`,
  `finance_mlm.payment_events`, `finance_mlm.settlement_runs`,
  `finance_mlm.payout_lines` and `finance_mlm.audit_events`, and the newest
  `created_at`, which must be before the damage;
- for UPDATE, DELETE or migration damage, a row or column you know the damage
  changed. The `created_at` check only catches inserts.

**A4. Export `tutor_advantage` from the scratch instance** to a temporary
private bucket (about 20 s at today's size). Use the native export, not a
local `pg_dump`: the server is PostgreSQL 17, and older local clients refuse
to dump it.
```bash
B=ta-dr-$D
gcloud storage buckets create gs://$B --project=$P --location=$R \
  --uniform-bucket-level-access --public-access-prevention --soft-delete-duration=0
SCRATCH_SA=$(gcloud sql instances describe ta-dr-$D --project=$P --format='value(serviceAccountEmailAddress)')
PROD_SA=$(gcloud sql instances describe cloud-sql --project=$P --format='value(serviceAccountEmailAddress)')
gcloud storage buckets add-iam-policy-binding gs://$B --member="serviceAccount:$SCRATCH_SA" --role=roles/storage.objectAdmin
gcloud storage buckets add-iam-policy-binding gs://$B --member="serviceAccount:$PROD_SA" --role=roles/storage.objectViewer
gcloud sql export sql ta-dr-$D gs://$B/tutor_advantage.sql.gz --database=tutor_advantage --project=$P
```

**A5. Import into a new database on `cloud-sql`** named
`tutor_advantage_r$D`. Never import into the live `tutor_advantage`.
```bash
gcloud sql databases create tutor_advantage_r$D --instance=cloud-sql --project=$P
gcloud sql import sql cloud-sql gs://$B/tutor_advantage.sql.gz \
  --database=tutor_advantage_r$D --user=postgres --project=$P
```
In the drill this reproduced 44 tables and 3,933 rows, together with all 119
indexes, 47 foreign keys, the `identity.prevent_sponsor_cycle` trigger and
function, and owner `postgres`. All of it was identical to the source.

**A6. Swap the names.** Connect to the **`postgres` maintenance database**
on `cloud-sql` (prod proxy, `…/postgres`, as the `ta-database_url` user) and
run these statements one at a time:
```sql
-- 1. stop new sessions to the damaged DB, then drop the open ones.
--    Only Tutor Advantage connects to it, as postgres. postgres cannot signal
--    superuser (cloudsqladmin) backends, and trying raises an ERROR, so filter on usename.
ALTER DATABASE tutor_advantage WITH ALLOW_CONNECTIONS false;
SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity
 WHERE datname = 'tutor_advantage' AND pid <> pg_backend_pid() AND usename = current_user;
-- 1b. should return no rows (an autovacuum worker does not block the rename)
SELECT pid, usename, backend_type, state FROM pg_stat_activity
 WHERE datname = 'tutor_advantage' AND pid <> pg_backend_pid();
-- 2. swap
ALTER DATABASE tutor_advantage RENAME TO tutor_advantage_damaged_20261105;   -- use your $D
ALTER DATABASE tutor_advantage_r20261105 RENAME TO tutor_advantage;          -- use your $D
-- 3. check
SELECT datname, datallowconn FROM pg_database WHERE datname LIKE 'tutor_advantage%';
```
Expect two rows: `tutor_advantage` with `datallowconn = t` (the restored
copy) and `tutor_advantage_damaged_<D>` with `f`.

The damaged database stays closed, so a stray client cannot write to it. The
reconcile owner opens it only when needed, with
`ALTER DATABASE tutor_advantage_damaged_<D> WITH ALLOW_CONNECTIONS true`, and
closes it again afterwards.

If a rename fails with "being accessed by other users", run 1 and 1b again
**for the name you are trying to rename**, then retry. Do not leave the swap
half done. Between the two renames the instance has no `tutor_advantage`:
either retry the second rename, or rename the first one back.

**Rollback of the swap**, at any point before Reconcile is signed off:
1. Close every psql or `\copy` session from A9.
2. Block and terminate on `tutor_advantage` as in step 1, then rename it to
   `tutor_advantage_r<D>`.
3. Block and terminate on `tutor_advantage_damaged_<D>` (A9 may have
   reopened it), then rename it to `tutor_advantage`.
4. Run `ALTER DATABASE tutor_advantage WITH ALLOW_CONNECTIONS true` and
   restart the services (A8).

Anything written to the restored copy while it was live must then be
reconciled.

**A7. Bring the schema up to the deployed code.** The migrate job runs its
own image, `database-migrate:<sha of the last deploy>`, which runs
`prisma migrate deploy` against `ta-database_url`. That URL now reaches the
restored copy. **First list what the job would apply.** Check out the
deployed commit, point `DATABASE_URL` at the restored `tutor_advantage`
through the prod proxy, and run
`npx prisma migrate status --schema=packages/database/prisma/schema.prisma`.

- **If the incident was caused by a migration**, or a pending migration is
  one you have not reviewed, **do not execute the job.** Its image contains
  that migration and would apply it again to the clean copy. First fix it in
  git:
  1. Delete the bad migration's folder.
  2. Add a corrected migration with a new, later timestamp. Never edit an
     applied migration in place.
  3. Deploys are frozen (step 4), so build and push images from that commit
     by hand: the `database-migrate` image and every service image that must
     match the new schema.
  4. Point the job at the new image with
     `gcloud run jobs update tutor-advantage-db-migrate --region=$R --project=$P --image=<image>`.
  5. Deploy those service images in A8 instead of the no-op restart.
  6. Run `migrate status` again.

  Merge the fix to `main` before re-enabling deploys, or the next deploy
  brings the bad migration back.
- Otherwise, execute the job:
```bash
gcloud run jobs execute tutor-advantage-db-migrate --region=$R --project=$P --wait
```
Afterwards, `select count(*), max(migration_name) from public._prisma_migrations`
on `tutor_advantage` must show the newest migration you intend to have. In the drill, the 2026-11-04 backup needed one migration,
`20261105090000_support_tickets`, which applied in 10 s. The job has
`--max-retries=0`. If it fails half way, do **not** re-run it blindly:
1. Find the failed migration with
   `select migration_name, started_at, finished_at, rolled_back_at, logs from public._prisma_migrations where finished_at is null`.
2. Either finish its remaining statements by hand, or undo its partial changes.
3. Mark it with `npx prisma migrate resolve --applied <name>` or
   `--rolled-back <name>`, with `DATABASE_URL` pointed at the restored database
   through the proxy.
4. Execute the job again.

**A8. Restart the DB clients** so no pooled connection or cached state from
before the swap survives. `SECRET_REFRESH_AT` is a no-op variable used to roll
a new revision:
```bash
T=$(date -u +%Y%m%dT%H%M%SZ)
for s in identity-service learning-service finance-mlm-service admin-console; do
  gcloud run services update "$s" --region=$R --project=$P --update-env-vars=SECRET_REFRESH_AT=$T
  gcloud run services describe "$s" --region=$R --project=$P --format='value(status.latestReadyRevisionName)'
done
```
Each one must show a new ready revision. Check Cloud Logging for
`severity>=ERROR` on the new revisions. Internal ingress blocks your browser
and `gcloud run services proxy`, so real smoke tests wait until A10.

**A9. Carry the gap rows over before reopening.** Do this while ingress is
still internal. Once users come back, new tickets would reuse ticket numbers
and returning users would get new ids.

Postgres cannot query across databases, so stage the rows with psql over the
prod proxy, then insert them in one transaction. Do not write local files.
Psql 16 works against this server. Set `PGHOST=127.0.0.1`, `PGPORT=<prod proxy port>`,
`PGUSER=postgres` and `PGPASSWORD` from the secret, without echoing it.

1. Open `tutor_advantage_damaged_<D>` (A6). On `tutor_advantage`, run
   `CREATE SCHEMA dr_gap;`. Then, for each table below, run
   `CREATE TABLE dr_gap.<t> (LIKE <schema>.<t> INCLUDING DEFAULTS);`, with no
   constraints, indexes or triggers.
2. Stream each table from the damaged DB into staging. Use an explicit column
   list on both sides: if A7 kept a bad migration out, the damaged DB can have
   columns the restored one lacks.
   ```bash
   psql -d tutor_advantage_damaged_<D> -c "\copy (select <cols> from <schema>.<t> where created_at >= '<backup startTime>'::timestamptz - interval '1 day') to stdout" \
     | psql -d tutor_advantage -c "\copy dr_gap.<t> (<cols>) from stdin"
   ```
   A backup is not consistent at a single timestamp, so take a wide window.
   The insert in step 3 skips rows that already exist.
3. In **one** psql session on `tutor_advantage`, run `BEGIN;`, then insert
   per table, in this order, and leave triggers enabled:
   ```sql
   INSERT INTO <schema>.<t> (<cols>)
   SELECT <cols> FROM dr_gap.<t> s
   WHERE NOT EXISTS (SELECT 1 FROM <schema>.<t> x WHERE x.<pk> = s.<pk>);
   ```
   Insert these tables, in this order, and skip rows that are part of the
   damage:
   - `identity.users`, `identity.oauth_identities`,
     `identity.user_consents`, `identity.guardian_consents`;
   - `learning.classes` created in the gap (parents of tickets, codes and
     enrollments);
   - `learning.support_tickets`, then `learning.support_ticket_messages`;
   - `finance_mlm.discount_codes`;
   - `finance_mlm.settlement_runs` created in the gap (parents of
     adjustments), copied as recorded. Approve or send nothing;
   - `finance_mlm.fraud_flags`, `finance_mlm.adjustments` (with their
     approve/reject state), `finance_mlm.exceptions` and
     `finance_mlm.audit_events`. These control payout holds and the next
     settlement.

   A foreign-key error rolls the whole transaction back. Check for missing
   parents first: for each child, select staged rows whose parent id is
   neither in the live table nor staged (for example
   `support_tickets.class_id` and `adjustments.settlement_run_id`). Then add
   the parent or leave the row out and record it. Check the inserted counts,
   then run `COMMIT;`, or `ROLLBACK;` if anything looks wrong.
4. Run `DROP SCHEMA dr_gap CASCADE;`, close your sessions, and run
   `ALTER DATABASE tutor_advantage_damaged_<D> WITH ALLOW_CONNECTIONS false`.

Do **not** copy `finance_mlm.discount_code_redemptions`, payments,
enrollments or payouts here. Each redemption needs its `payment_intents` row,
and gap intents are rebuilt from Omise in Reconcile 2. Redemptions follow in
Reconcile 5. Rows that the damage UPDATED or DELETED are not fixed by this
insert-only copy: handle them by hand, or with Path C. Then move the ticket
sequence past every number the damaged DB issued. Read `select last_value from learning.support_tickets_ticket_number_seq`
on the damaged DB, and on `tutor_advantage` run:
```sql
SELECT setval('learning.support_tickets_ticket_number_seq',
  greatest(<last_value from damaged>, (SELECT coalesce(max(ticket_number), 0) FROM learning.support_tickets)));
```

**A10. Reopen and smoke test.** Reverse step 5 for all four services
(`--ingress=all`). Then immediately check `/health` on the three backends, an
admin login, one class list and one payment list. If anything is wrong, set
`--ingress=internal` again and decide between fixing forward and the swap
rollback (A6). Then un-snooze the alerts and go to
[Reconcile](#reconcile-after-any-restore). Schedulers and deploys stay frozen
until the reconcile owner releases them.

**A11. Clean up.** Delete the scratch instance and the bucket as soon as
nothing needs them:
```bash
gcloud storage rm -r gs://ta-dr-$D --project=$P
gcloud sql instances delete ta-dr-$D --project=$P
```
Keep `tutor_advantage_damaged_<D>` until the Finance Lead signs off
Reconcile. Then drop it, and only it:
```bash
gcloud sql databases delete tutor_advantage_damaged_<D> --instance=cloud-sql --project=$P
```
Never delete `tutor_advantage` itself.

## Path C: recover a few rows or one table

Do A1–A3 only. A write freeze (step 5) is needed only if the damage is still
happening. Read the rows from the scratch instance and write them back to
`tutor_advantage`. Use a reviewed SQL script in `BEGIN … COMMIT`, or the admin
console where a screen exists. Do not disable triggers to load data:
`identity.prevent_sponsor_cycle` and the partial unique indexes must stay
active. For money tables follow `payout-incident-response.md`: corrections are
adjustments, never edits of APPROVED records.

Then delete **only the scratch instance**:
`gcloud sql instances delete ta-dr-$D --project=$P`. Path C creates no
bucket, swaps no names and drops no database; `tutor_advantage` is still the
live database.

## Path B: `cloud-sql` is gone (not drilled)

This restores **all products**, so run it together with the other product
owners.

1. **Find the retained backups.** After deletion they are project-level
   backups that you restore by **name**, not by run id. This listing works
   today and already shows `cloud-sql`'s backups:
   ```bash
   gcloud sql backups list --project=$P --filter='instance:cloud-sql' \
     --format='table(name,type,state,windowStartTime)'
   ```
   If nothing is listed, no retained backup exists. Then rebuild from the
   newest `gcloud sql export sql` dump in GCS, if one exists (Known gap 2).
2. **Create the new instance** as in A1, but with production settings:
   `db-g1-small` or larger, backups and PITR on, deletion protection on.
   Then restore by name, **without** `--backup-instance`:
   ```bash
   gcloud sql backups restore projects/reading-advantage/backups/<NAME> \
     --restore-instance=<new> --project=$P
   ```
   Confirm afterwards that backups, PITR and deletion protection are on.
3. **Repoint everything that names the connection**
   `reading-advantage:asia-southeast1:cloud-sql`:
   - Add new versions of `ta-database_url`, `ta-database_url_reading_advantage`
     and `ta-database_url_primary_advantage` that end in
     `?host=/cloudsql/reading-advantage:asia-southeast1:<new>`. Pipe the old
     value through `sed` into `gcloud secrets versions add … --data-file=-`
     so you never echo it. Check that only the host part changed.
   - Attach the new instance with
     `gcloud run services update <svc> --region=$R --project=$P --set-cloudsql-instances=$P:$R:<new>`
     for identity-service, learning-service, finance-mlm-service and
     **admin-console**. deploy.yml does not attach admin-console.
   - Point the migrate job at it with
     `gcloud run jobs update tutor-advantage-db-migrate --region=$R --project=$P --set-cloudsql-instances=$P:$R:<new>`.
   - Edit `.github/workflows/deploy.yml`: both lines that name `cloud-sql`
     (the migrate job's `--set-cloudsql-instances` and the services'
     `--add-cloudsql-instances`). Push this while deploys are still disabled
     (step 4), then re-enable. Otherwise the pipeline re-attaches the old name
     and runs migrations against it.
   - Grant nothing new. The runtime service accounts already have
     `roles/cloudsql.client` at project level. Check with
     `gcloud projects get-iam-policy $P --flatten=bindings --filter='bindings.role:roles/cloudsql.client' --format='value(bindings.members)'`.
4. Then do A8, A10 and Reconcile. Everything since the backup is lost (up to
   about 24 h today).

## Reconcile after any restore

Everything between the restore point and the freeze now exists only outside
the database (Omise, LINE, GCS, logs) or in the damaged/forensic copy. Work
through this list in order and record each result in an incident note.

1. **Omise transfers first (double-payout risk).** If a settlement was
   approved or sent after the restore point, the restored DB shows it as not
   approved, or its documents as `NOT_SENT`. Transfer webhooks for unknown
   transfers are answered with 200 and never redelivered
   (`transferWebhookController.ts`). Before **any** settlement action, list
   the Omise transfers since the restore point (Omise dashboard → Transfers,
   or `GET /transfers`). Match them by `metadata.payoutLineId` and
   `metadata.settlementRunId`. A new preview/approve creates new payout line
   ids, so Omise idempotency keys would not stop a second transfer.
2. **Omise charges.** There is no charge sync job. List the charges created
   since the restore point (Omise dashboard → Charges, filtered by date) and
   compare them with `finance_mlm.payment_intents` by
   `metadata.paymentIntentId`.
   - Intent exists and is still pending: admin console → Reconciliation →
     re-verify with Omise.
   - Intent missing because it was created in the gap: replaying its webhook
     returns 500, because `payment_events` has a foreign key to
     `payment_intents`, and it never reaches the orphan queue. Recreate the
     intent and enrollment from `tutor_advantage_damaged_<D>` (or from the
     forensic backup), or activate the enrollment manually in Reconciliation,
     keyed by the Omise charge id.
   - Two successful charges for one enrollment (the student paid again
     because the restore showed "unpaid"): refund the extra one in Omise.
3. **Disputes and refunds.** After the charges are fixed, run the idempotent
   sync once by hand, then check its result in its logs. It reads 45 days of
   Omise disputes and refunds:
   ```bash
   gcloud scheduler jobs run ta-daily-dispute-sync --location=$R --project=$P
   ```
4. **Finance controls.** Compare `fraud_flags`, `adjustments`, `exceptions`
   and `audit_events` with the damaged DB again, in case anything was missed
   in A9. In Path B there is no damaged copy, so use the forensic backup.
   Before anyone runs a settlement, the Finance Lead checks the held-tutor
   list and the approved-adjustment totals against the damaged copy and signs
   off.
5. **Discount codes.** After step 2 has recreated the gap payment intents and
   enrollments, copy every gap `finance_mlm.discount_code_redemptions` row
   from the damaged DB, keeping its ids, the same way as A9. Then check that
   all of them are present. Each code is single-use (one code = one seat), so
   a missing redemption makes a used code redeemable again. Until this is
   done, set `status = 'VOID'` on any code that was redeemed in the gap.
6. **Users.** Accounts created in the gap that were not carried over in A9
   are gone. On the next login the same Google, LINE or Facebook identity
   creates a **new** user id. Re-link Omise charges
   (`metadata.studentUserId`) and sponsor/upline links to the new ids.
   Re-apply any role changes, deactivations and admin revocations made in the
   gap, because the rollback silently undid them.
7. **Privacy requests.** A restore can bring back personal data that was
   deleted under a `PRIVACY` ticket. Re-apply every deletion recorded after
   the restore point (`student-service-requests.md`, privacy section).
8. **KYC uploads.** Objects uploaded to `tutor-advantage-verification` in the
   gap are orphans that hold PII. Match them to tutors from the damaged copy
   or ask the tutors to upload again, then delete the orphans. Replaced
   documents whose old object was deleted can be recovered within 7 days (see
   [Buckets](#buckets)).
9. **LINE reminders.** The gap's `learning.notification_deliveries` rows are
   gone, and LINE's retry key lasts only 24 h. Resuming
   `ta-book-payment-reminders` therefore re-sends the current milestone to
   every unpaid package, including students who paid in the gap. Resume it
   only after step 2. Copy the gap delivery rows from the damaged copy if you
   want to avoid repeat messages.
10. **Release the freezes.** Resume the scheduler jobs, check that all four
    are `ENABLED`, and re-enable the Deploy workflow. If commits were merged
    during the freeze, the next push deploys them all, so check that their
    migrations suit the restored database first. Then tell Finance that
    settlement is unfrozen.
    ```bash
    for j in ta-class-session-reminders ta-book-payment-reminders ta-daily-dispute-sync ta-ticket-overdue-digest; do
      gcloud scheduler jobs resume "$j" --location=$R --project=$P
    done
    gcloud scheduler jobs list --location=$R --project=$P --filter='name~/jobs/ta-' --format='value(name.basename(),state)'
    ```

## Secrets and runtime config

Secrets are not in the database backups. Secret Manager has no undelete:
**deleting a secret destroys every version immediately.** Disabling a version
can be undone; destroying one cannot.

| Secret | Used by | If lost |
|---|---|---|
| `ta-database_url` | identity, learning, finance, admin-console, migrate job | **Do not reset the `postgres` password.** It is the admin user of the shared instance, and other products may connect as it. Recover the password from older versions of this secret, from the owner's password manager, or from the instance owner. Rebuild the value as `postgresql://postgres:<url-encoded pw>@localhost/tutor_advantage?host=/cloudsql/reading-advantage:asia-southeast1:cloud-sql`. Reset the password only as a last resort, agreed with every product owner on `cloud-sql` (Known gap 6) |
| `ta-database_url_reading_advantage`, `ta-database_url_primary_advantage` | learning (read-only lesson content of other products) | ask the owning team |
| `ta-pii_encryption_key` | identity, finance | **Unrecoverable.** Every `identity.users.passport_number_enc` becomes unreadable, and foreign-tutor settlement breaks. There is one version (2026-10-16). Keep an offline escrow copy (Known gap 3) |
| `ta-jwt_secret` | all 6 services | generate a new value of at least 32 characters; every user is logged out |
| `ta-internal_api_key` | identity, learning, finance; copied into the headers of the 4 live `ta-*` scheduler jobs and into the uptime-check relay | Add a new version and roll new revisions of identity, learning and finance. Update each live job **in place**: `gcloud scheduler jobs update http <job> --location=$R --project=$P --update-headers=X-Internal-Key=<new>`. Do not delete and recreate the jobs. Then re-run `infra/monitoring/apply-monitoring.sh` |
| `ta-omise_private_key`, `ta-omise_public_key`, `ta-omise_webhook_secret` | finance | re-issue from the Omise dashboard |
| `ta-line_channel_access_token`, `ta-line_channel_secret` | identity, learning | re-issue in LINE Developers |
| `ta-auth_google_id`, `ta-auth_google_secret` | identity, admin-console | Google Cloud OAuth client |
| `ta-discord-webhook-url`, `ta-discord-tickets-webhook-url` | backends; learning | create a new webhook in the channel |
| `ta-google_generative_ai_api_key`, `ta-openai_api_key`, `ta-google_translate_api_key` | identity and learning; learning; tutor-pwa | re-issue at the provider |

A runtime service account must have `roles/secretmanager.secretAccessor` on a
secret **before** a revision mounts it, or the revision fails to start.

Some config lives only on the live services. It survives deploys, because
deploy.yml uses `--update-env-vars/--update-secrets`, but it is not in git.
Snapshot it after any manual change and before a rebuild, and store the file
privately. It contains plain env values and secret **names**, no secret
values:
```bash
for s in identity-service learning-service finance-mlm-service admin-console student-liff tutor-pwa; do
  gcloud run services describe "$s" --region=$R --project=$P \
    --format='yaml(spec.template.spec.serviceAccountName,spec.template.metadata.annotations,spec.template.spec.containers[0].env)'
done > ta-run-config-$(date -u +%Y%m%d).yaml
```
Plain env vars worth knowing on 2026-11-05:
- learning: `LIFF_URL`, `ADMIN_CONSOLE_URL`, `TUTOR_PWA_URL`, `AI_VOICE_*`;
- finance: `PAYOUT_HOLD_DAYS_*`, `RISK_*`, `COMMISSION_BASE_RATE`, the app base
  URLs and `VERIFICATION_BUCKET_NAME`;
- identity: `OAUTH_REDIRECT_URI`, `GCS_BUCKET_NAME`,
  `VERIFICATION_BUCKET_NAME`, `NEXT_PUBLIC_LIFF_ID`.

**Images.** Every deploy pushes `<service>:<sha>` to
`asia-southeast1-docker.pkg.dev/reading-advantage/tutor-advantage`, and any
commit can be rebuilt from git with the Dockerfiles.

**Service accounts.** Runtime accounts are
`ta-{identity,learning,finance,admin-console,student-liff,tutor-pwa}-run`.
Migrations run as `ta-db-migrate`, and deploys as `ta-deployer` through WIF.

## Buckets

| Bucket | Content | Protection | If deleted |
|---|---|---|---|
| `tutor-advantage-verification` (private) | Tutor KYC documents at `verification/<userId>/<uuid>.<ext>`, referenced from `identity.users` | Soft delete 7 days, no versioning, public access prevented | Within 7 days: `gcloud storage ls --soft-deleted gs://tutor-advantage-verification/**`, then `gcloud storage restore gs://…#<generation>`. After 7 days, tutors must upload again |
| `tutor_advantage_bucket` (public) | Lesson audio, TTS manifests and assessment JSON (about 500 MB); paths derived from article ids | Soft delete 7 days, no versioning | Restore as above within 7 days. After that, regenerate with `scripts/generate-article-tts.mjs` and `scripts/generate-assessment-catalog.mjs` (costs TTS/API usage) |

Replacing a KYC document deletes the old object at once (identity
`storage.ts`). After a DB restore, some restored rows may point at objects
that now exist only in soft delete, so restore those within the 7 days.

## Known gaps

These were found on 2026-11-05. Each needs an owner's decision, and none is
fixed yet.

1. **PITR clone is broken.** `gcloud sql instances clone cloud-sql …` fails
   with `NETWORK_PEERING_DELETED`. `cloud-sql` has a private IP (10.10.20.3)
   on VPC `sql-connect-vpc`, but that network no longer has a Service
   Networking peering; only `default` has one. Until this is fixed, only
   daily backups can be restored, so the RPO is up to 24 h instead of
   seconds. The fix is for the network owner: re-create the private services
   access connection on `sql-connect-vpc`, or remove the instance's private
   IP if nothing uses it. The network is shared, so coordinate with the other
   products.
2. **No copy outside the instance.** All backups belong to `cloud-sql` in the
   same project, so one project-level mistake loses them all. One option is a
   scheduled `gcloud sql export sql … --database=tutor_advantage` to a locked
   private bucket with a retention policy. The export contains PII, so this
   needs a retention decision.
3. **`ta-pii_encryption_key` has a single copy.** Losing it makes passport
   numbers unreadable forever. Keep an offline escrow copy with the owner.
4. **Runtime config and IAM are not in code.** Snapshot them after each
   manual change (see [Secrets and runtime config](#secrets-and-runtime-config)).
5. **Zonal instance on `db-g1-small`.** A zone outage takes Tutor Advantage,
   and every other product, down until Google restores the zone. Regional HA
   is a cost decision for the shared instance.
6. **Tutor Advantage connects as the shared `postgres` user.** A leaked or
   rotated password affects every product on `cloud-sql`. One option is a
   dedicated login role that owns the Tutor Advantage schemas, so that it can
   be rotated alone. The migrate job needs DDL rights.
7. **Repo drift.** The `infra/cloud-scheduler/*.yaml` files were brought in
   line with the live job names on 2026-11-05 (the dispute job is
   `ta-daily-dispute-sync`). Still take names from the live list.

## Drill log

Run a drill every quarter, and after any change to the instance, the network
or this runbook. Always use a scratch instance, never `cloud-sql`.

**2026-11-05** (engineer + Claude Code), backup `1793811600000`
(window 2026-11-04 17:00 UTC):

| Step | Result | Time |
|---|---|---|
| PITR clone to scratch | **Failed** with `NETWORK_PEERING_DELETED` (Known gap 1) | — |
| Create a public-IP scratch instance | OK | 4 min 27 s |
| Restore the daily backup into scratch | OK | 5 min 7 s |
| Compare 11 key tables with production rows created ≤ backup time | 0 differences (users 51, payment_intents 73, payment_events 70, settlement_runs 3, payout_lines 3, audit_events 52, …) | — |
| Migration history | 51 rows, the same as production. 4 old rolled-back attempts are also in production | — |
| Native export of `tutor_advantage` | OK, 265 KB gzip | 21 s |
| Import into a new database | OK. 44/44 tables, 3,933 rows, 119 indexes, 47 FKs, the trigger and function, and owner `postgres` all identical | 21 s |
| `prisma migrate deploy` on the restored DB | Applied `20261105090000_support_tickets` | 10 s |
| Name swap (A6) on a separate scratch instance, as `postgres` with an open client | Block, terminate (1 session), rename both and re-allow all OK. The old client was disconnected, a reconnect read the restored copy, and the damaged DB refused connections | about 0.5 s |
| Swap rollback | OK. A reconnect read the original again | about 0.4 s |
| Cleanup | Both scratch instances and the bucket deleted | — |

Not yet exercised against production: the deploy freeze (step 4), the
ingress freeze (step 5), the swap on `cloud-sql` itself, and Path B.
