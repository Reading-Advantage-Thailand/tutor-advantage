# Scheduled LINE reminders (learning-service)

Two Cloud Scheduler jobs call learning-service internal routes. Both send
LINE pushes through the student OA (`LINE_CHANNEL_ACCESS_TOKEN`) and respect
the student's `notifyClassReminders` setting ("เตือนก่อนเข้าเรียน" in the
LIFF notifications page).

| Job | Schedule (Asia/Bangkok) | Route | Template |
|---|---|---|---|
| `ta-class-session-reminders` | every 5 min (`*/5 * * * *`) | `POST /v1/internal/reminders/class-sessions` | `infra/cloud-scheduler/class-reminder-cron.yaml` |
| `ta-book-payment-reminders` | daily 10:00 (`0 10 * * *`) | `POST /v1/internal/reminders/book-payments` | `infra/cloud-scheduler/book-payment-reminder-cron.yaml` |

Both routes need the `X-Internal-Key` header (Secret Manager
`ta-internal_api_key`, the same key finance uses); no JWT. A wrong or missing
key, or `INTERNAL_API_KEY` not set on the service, returns 401
`UNAUTHORIZED`. A run returns 200 with
`{considered, sent, skipped, failed, alreadyHandled}` and logs the same under
the `[ReminderService]` tag. The book-payment route answers 503
`REMINDER_DELIVERIES_FAILED` (same counts in the body) when `failed > 0`, so
Cloud Scheduler retries it the same day (see step 4 below).

## What each job does

**Class session reminder** ("คลาสจะเริ่มในอีก 15 นาที")
- Classes: `is_demo = false`, `setup_required_at IS NULL`, status OPEN or FULL
  (any case), `schedule_data` set, and `ends_at` empty or at most 2 days ago.
- Session starts come from `schedule_data`: dated entries
  `{date, start}` are Bangkok wall-clock times; legacy weekly entries
  `{day: "MON", start}` count for today and tomorrow (Bangkok) inside
  `starts_at`..`ends_at`. Malformed entries are ignored.
- A session is due when it starts in `(now, now + leadMinutes]`
  (default 15, body `{"leadMinutes": 5..120}`). A session that has started is
  never reminded.
- Every ACTIVE enrollment's student gets one Flex card with a "ดูคลาส" button
  to `/classes/{classId}` in the LIFF.
- Dedup key: `class-session:{classId}:{date}T{start}:{studentUserId}`.

**Book payment follow-up**
- `enrollment_packages.status = 'PENDING_PAYMENT'` (the tutor opened a new
  book), the enrollment is ACTIVE, and the class is not CLOSED.
- Day 1, 3 and 7 after the package was created (Bangkok calendar days). Only
  the latest milestone reached is sent; a missed earlier one is not back-filled.
  Nothing after day 14. At most one message per package per run.
- Text message with the book, the class and `ชำระเงิน: <LIFF /payment link>`.
- Dedup key: `book-payment:{enrollmentPackageId}:d{1|3|7}`.

## How sending is made safe (learning.notification_deliveries)

1. Before sending, the run inserts a row with status `CLAIMED`. The unique
   `dedup_key` means a second run (scheduler retry, overlapping run, second
   instance) cannot claim the same reminder.
2. The push carries `X-Line-Retry-Key = delivery_id`. If LINE already accepted
   that key (409), it counts as sent. LINE remembers a key for 24 hours only.
3. Outcome:
   - `SENT` (+ `sent_at`)
   - `SKIPPED` with `reason` `PREFERENCE_DISABLED`, `LINE_NOT_LINKED` or
     `USER_NOT_FOUND`: permanent, never retried.
   - `FAILED` with `reason` `LINE_NOT_CONFIGURED`, `LINE_API_<status>` or
     `UNEXPECTED_ERROR`, `attempts + 1`.
4. A later run retries a `FAILED` row with `attempts < 3` while it is still due
   (the class has not started / the package is still unpaid and in the same
   milestone), reusing the same `delivery_id` as the retry key. A row stuck in
   `CLAIMED` too long (the run died mid-send) is reclaimed the same way and its
   attempt counts: after 4 minutes for class reminders (shorter than the
   5-minute cron, so the next run still lands before the session starts) and
   10 minutes for book payments.
   - Class reminders always retry within minutes. Book payments run daily, so
     the route answers 503 on any failure and Cloud Scheduler retries it 5
     times over about 30 minutes (1, 3, 7, 15, 31 min), well inside LINE's
     24-hour key memory.
   - A row first claimed more than 20 hours ago whose earlier attempt may have
     reached LINE (still `CLAIMED`, `UNEXPECTED_ERROR`, `LINE_API_ERROR` or
     `LINE_API_5xx`) is not retried: it becomes `SKIPPED / RETRY_KEY_EXPIRED`,
     because the old key could no longer stop a duplicate. A clear rejection
     (`LINE_API_4xx`, `LINE_NOT_CONFIGURED`) is still retried the next day.
5. A run handles at most 500 deliveries (soonest sessions first) and logs
   `Delivery limit reached` with the number deferred to the next run.

## Production setup (not done yet)

1. Run the migration `20261104120000_notification_deliveries` (the deploy
   workflow runs `tutor-advantage-db-migrate` before the services).
2. **Grant the learning runtime service account access to the shared key
   before deploying.** `deploy.yml` now mounts
   `INTERNAL_API_KEY=ta-internal_api_key:latest` on learning-service; without
   this grant the learning-service deploy fails.

   ```bash
   gcloud secrets add-iam-policy-binding ta-internal_api_key \
     --member="serviceAccount:ta-learning-run@reading-advantage.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" \
     --project=reading-advantage
   ```

3. Check `LIFF_URL` and `LINE_CHANNEL_ACCESS_TOKEN` are set on the
   learning-service Cloud Run service (they are not managed by `deploy.yml`).
   Without `LIFF_URL` the card has no button and the payment text no link.
4. Create the jobs (read the key from Secret Manager; do not paste it into
   shell history on shared machines):

   ```bash
   LEARNING_URL=$(gcloud run services describe learning-service \
     --region=asia-southeast1 --project=reading-advantage --format='value(status.url)')
   KEY=$(gcloud secrets versions access latest --secret=ta-internal_api_key --project=reading-advantage)

   gcloud scheduler jobs create http ta-class-session-reminders \
     --schedule="*/5 * * * *" --time-zone="Asia/Bangkok" \
     --uri="${LEARNING_URL}/v1/internal/reminders/class-sessions" \
     --http-method=POST \
     --headers="X-Internal-Key=${KEY},Content-Type=application/json" \
     --message-body='{"leadMinutes":15}' \
     --attempt-deadline=180s --max-retry-attempts=1 \
     --location=asia-southeast1 --project=reading-advantage

   gcloud scheduler jobs create http ta-book-payment-reminders \
     --schedule="0 10 * * *" --time-zone="Asia/Bangkok" \
     --uri="${LEARNING_URL}/v1/internal/reminders/book-payments" \
     --http-method=POST \
     --headers="X-Internal-Key=${KEY},Content-Type=application/json" \
     --message-body='{}' \
     --attempt-deadline=300s \
     --max-retry-attempts=5 --min-backoff=60s --max-backoff=3600s \
     --location=asia-southeast1 --project=reading-advantage
   ```

5. Test once by hand: `gcloud scheduler jobs run ta-book-payment-reminders
   --location=asia-southeast1` and read the 200 summary in the learning-service
   logs (`[ReminderService]`).

Rotating the key: add a new secret version, redeploy finance and learning,
then update the `X-Internal-Key` header on every scheduler job
(`gcloud scheduler jobs update http <job> --update-headers=...`).

## Checking deliveries

```sql
-- What happened in the last day
SELECT kind, status, reason, count(*)
FROM learning.notification_deliveries
WHERE created_at > now() - interval '1 day'
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

-- Failures still to be retried, and stuck claims
SELECT delivery_id, kind, status, reason, attempts, updated_at
FROM learning.notification_deliveries
WHERE status IN ('FAILED', 'CLAIMED')
ORDER BY updated_at DESC LIMIT 50;

-- Everything one student was sent for one class
SELECT dedup_key, status, reason, sent_at
FROM learning.notification_deliveries
WHERE user_id = '<student uuid>' AND class_id = '<class uuid>'
ORDER BY created_at DESC;
```

Many `LINE_NOT_LINKED` rows are normal (students who log in without LINE).
`LINE_API_429` means the OA's monthly push quota or rate limit was hit.

## Disabling

- Pause a job: `gcloud scheduler jobs pause ta-class-session-reminders
  --location=asia-southeast1 --project=reading-advantage` (`resume` to turn it
  back on). Nothing else sends these reminders.
- One student: they turn off "เตือนก่อนเข้าเรียน" in the LIFF notifications
  page (`settings.notifications.notifyClassReminders = false`); their rows
  become `SKIPPED / PREFERENCE_DISABLED`.
- Do not delete `notification_deliveries` rows to "resend": removing a row
  lets the next run send that reminder again.

## Code map

- `services/learning-service/src/services/ReminderService.ts`: schedule maths,
  milestones, message builders, claim/send/record loop
- `services/learning-service/src/controllers/reminderController.ts`: the two
  internal handlers (key check, `leadMinutes` validation)
- `services/learning-service/src/services/LineNotificationService.ts`:
  `retryKey` option (`X-Line-Retry-Key`, 409 = already accepted)
- `packages/shared-config/src/internalAuth.ts`: `isValidInternalKey`
  (constant-time `X-Internal-Key` check)
