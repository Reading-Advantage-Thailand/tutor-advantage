# Monitoring alerts → Discord

Tutor Advantage sends operational alerts to one Discord channel by two paths:

| Path | What | How |
|---|---|---|
| **App errors** | every `logger.error(...)` in identity, learning and finance (unhandled 5xx, uncaught exceptions, failed jobs) | `DiscordAlertTransport` in shared-config posts straight to `DISCORD_WEBHOOK_URL`. Throttled per instance: the same error (numbers/ids normalised) at most once per 10 min, with "(+N similar suppressed)" on the next post, and at most 10 posts per 5 min overall. Logs written with `{ alert: false }` are never posted. Discord is a third party, so a post carries only the redacted first line of the message (≤ 200 chars) and the error class plus its `at …` stack frames; full messages and stacks stay in Cloud Logging / Error Reporting (search by `requestId`). |
| **Cloud Monitoring alerts** | uptime checks, 5xx spikes, Cloud Scheduler and DB-migration failures, crash loops | Alert policy → notification channel **"Tutor Advantage → Discord relay"** (`webhook_basicauth`) → identity-service `POST /v1/internal/alerts/monitoring` → Discord embed. |

The relay authenticates Monitoring with HTTP Basic auth: user `monitoring`,
password = `INTERNAL_API_KEY` (Secret Manager `ta-internal_api_key`, the same
key Cloud Scheduler uses). Anything else gets 401 `UNAUTHORIZED`, and so does
every call when `INTERNAL_API_KEY` is not set on identity-service. Once
authenticated the relay **always answers 200**, even if Discord is down or
`DISCORD_WEBHOOK_URL` is unset: a non-2xx would make Monitoring retry and
repost. Delivery failures are logged as a warning
(`[MonitoringRelay] Discord delivery failed`, `alert: false`), never as an
error, so they cannot loop back into Discord.

An open incident posts a red **🔴 ALERT: &lt;policy&gt;** embed; when it closes a
green **✅ RESOLVED: &lt;policy&gt;** follows. Each has the condition, resource,
observed/threshold value (metric policies), start/end time in Bangkok time, the
policy's documentation text and an "Open in Cloud Console" link.

Code: `services/identity-service/src/controllers/monitoringAlertController.ts`
(auth), `services/identity-service/src/services/monitoringAlert.ts` (payload →
embed). Setup script: `infra/monitoring/apply-monitoring.sh`.

## One-time setup

1. **Discord webhook.** In the TA ops channel: Edit Channel → Integrations →
   Webhooks → New Webhook, name it "Tutor Advantage", copy the URL. Treat the
   URL as a secret (anyone with it can post).
2. **Secret.**
   ```bash
   printf '%s' 'https://discord.com/api/webhooks/…' | \
     gcloud secrets create ta-discord-webhook-url --project=reading-advantage \
       --replication-policy=automatic --data-file=-
   ```
   (Rotating later: `gcloud secrets versions add ta-discord-webhook-url --data-file=-`, then redeploy.)
3. **Grant the runtime service accounts** (each service only reads its own secrets):
   ```bash
   for sa in ta-identity-run ta-learning-run ta-finance-run; do
     gcloud secrets add-iam-policy-binding ta-discord-webhook-url --project=reading-advantage \
       --member="serviceAccount:${sa}@reading-advantage.iam.gserviceaccount.com" \
       --role=roles/secretmanager.secretAccessor
   done
   # identity-service now needs the internal key too (the relay's Basic-auth password)
   gcloud secrets add-iam-policy-binding ta-internal_api_key --project=reading-advantage \
     --member="serviceAccount:ta-identity-run@reading-advantage.iam.gserviceaccount.com" \
     --role=roles/secretmanager.secretAccessor
   ```
   Do this **before** the deploy: a Cloud Run revision whose SA cannot read a
   mounted secret fails to start.
4. **Deploy** (merge to `main`). `deploy.yml` mounts `DISCORD_WEBHOOK_URL` on
   the three backends and `INTERNAL_API_KEY` on identity-service.
5. **Smoke-test the relay** (needs the key locally; it is not echoed):
   ```bash
   KEY="$(gcloud secrets versions access latest --secret=ta-internal_api_key --project=reading-advantage)"
   URL="$(gcloud run services describe identity-service --project=reading-advantage --region=asia-southeast1 --format='value(status.url)')"
   curl -sS -u "monitoring:${KEY}" -H 'Content-Type: application/json' \
     -d '{"version":"1.2","incident":{"state":"open","policy_name":"TA: relay smoke test","summary":"Test from the runbook"}}' \
     "$URL/v1/internal/alerts/monitoring"
   unset KEY
   ```
   Expect `{"forwarded":true}` and a red embed in Discord.
   `{"forwarded":false,"reason":"NOT_CONFIGURED"}` means `DISCORD_WEBHOOK_URL`
   is not mounted.
6. **Create the Monitoring resources** (from Cloud Shell or any machine with
   gcloud, curl and python3; needs `roles/monitoring.editor` and read access to
   `ta-internal_api_key`):
   ```bash
   DRY_RUN=1 infra/monitoring/apply-monitoring.sh   # review the JSON first
   infra/monitoring/apply-monitoring.sh
   ```
   The script is idempotent: it finds each resource by display name and
   updates it, so re-run it after changing it or after rotating
   `ta-internal_api_key` (the channel stores a copy of the password). It
   reads the service URLs with `gcloud run services describe`; override with
   `IDENTITY_SERVICE_URL`, `STUDENT_LIFF_URL`, … if needed. Then in Console →
   Monitoring → Alerting → the channel → **Send test notification**.
7. **Email backup for identity-service down** (recommended; see Known
   limitations). Run the script with `ALERT_EMAIL` set to a monitored ops
   mailbox or group:
   ```bash
   ALERT_EMAIL=ops@example.com DRY_RUN=1 infra/monitoring/apply-monitoring.sh   # review
   ALERT_EMAIL=ops@example.com infra/monitoring/apply-monitoring.sh
   ```
   It upserts an `email` channel **"Tutor Advantage → email backup"** and adds
   it, next to the relay, to `TA: service down (identity-service)` only. Every
   other policy keeps the relay channel alone. Google sends no verification
   mail for email channels, so check the address before running and use
   **Send test notification** on the new channel afterwards. The address is read
   from the environment, not the command line arguments, and is not printed in
   the summary (the dry-run JSON does show it).
   **Always set `ALERT_EMAIL` on later runs too:** the policies are replaced in
   full, so a run without it detaches the email channel again (the channel
   itself stays, unused, until you delete it in the Console). The summary's last
   line says `email backup: on` or `off`.

## What each alert means and first checks

### Service down
`TA: service down (<service>)` — the uptime check `TA uptime: <service>`
(HTTPS GET every 5 min, 10 s timeout) failed from 2+ regions for 5 minutes.
Backends check `/health` (which runs `SELECT 1`, so a Cloud SQL outage shows up
here too); frontends check `/` and accept 2xx or 3xx.
- Cloud Run → the service → Revisions: is the latest revision ready? Did a deploy just happen?
- Logs around the start time: startup errors, missing secrets, `db_unreachable`.
- If every backend is down at once, check Cloud SQL (`cloud-sql` instance) first.
- Roll back: Cloud Run → Revisions → route 100% traffic to the previous revision.
- `TA: service down (identity-service)` is the one alert the relay cannot post
  (the relay is identity-service). If the script ran with `ALERT_EMAIL` it
  arrives by email from Google Cloud instead; nothing appears in Discord.

### 5xx spike
`TA: 5xx spike` — more than 10 HTTP 5xx responses in 5 minutes from one TA service.
- The app errors posted to Discord at the same time usually name the cause.
- Logs Explorer: `resource.labels.service_name="<service>" severity>=ERROR`.
- 503s from Cloud Run itself (no app log) mean instances are unavailable — check
  the revision, max instances and Cloud SQL connections.

### Cloud Scheduler job failed
`TA: Cloud Scheduler job failed` — a `ta-*` job logged an error (its HTTP call
failed or timed out).
- Cloud Scheduler → the job → last attempt status.
- 401: `INTERNAL_API_KEY` on the target service does not match the job's
  `X-Internal-Key` header. 503 from book-payment reminders: some LINE pushes
  failed and the job retries (see `scheduled-reminders.md`). Other 5xx: target
  service logs.

### DB migration job failed
`TA: DB migration job failed` — the `tutor-advantage-db-migrate` Cloud Run job
logged an error, so the deploy did not continue.
- Cloud Run → Jobs → `tutor-advantage-db-migrate` → latest execution logs.
- The GitHub Actions deploy run that triggered it.
- Do not re-run blindly: a half-applied migration may need a manual fix first.

### Container crash loop
`TA: container crash loop` — a TA container exited with `Container called
exit(1)` or logged an uncaught exception.
- Read the logs just before the exit; the uncaught exception is also in Discord
  via the app-error path.
- Check env vars / secrets changed in the latest revision.
- Repeated within minutes = crash loop: roll back the revision.

There is deliberately **no** generic "any error log" policy: app errors already
reach Discord directly, with throttling.

## Silencing

- **One alert / maintenance window:** Console → Monitoring → Alerting →
  **Snooze**, pick the policies and a time range. Incidents during a snooze are
  not sent to the channel.
- **Disable a policy:** toggle it off in the Console (re-running the script
  turns it back on).
- **Stop all Discord posts** (both paths): remove the `DISCORD_WEBHOOK_URL`
  secret mount from the services (`gcloud run services update <svc>
  --remove-secrets=DISCORD_WEBHOOK_URL`), or delete the webhook in Discord. The
  relay then answers 200 with `NOT_CONFIGURED`, so Monitoring does not retry.
  Note the next deploy mounts it again.

## Known limitations

- **identity-service down = its own alert cannot be relayed.** The relay runs
  on identity-service, so without a backup `TA: service down
  (identity-service)` (or an outage of all backends) has nowhere to go. The
  incident is still open and visible in Console → Monitoring → Alerting /
  Uptime checks. Mitigation: run the script with `ALERT_EMAIL` (One-time setup
  step 7), which attaches the **"Tutor Advantage → email backup"** channel to
  that policy. Only that policy gets it. While identity-service is down, other
  incidents (for example 5xx spikes or crash loops on identity-service
  itself) are still lost from Discord, but the identity-service down email
  tells you to look in the Console. Do not add an email channel by hand in the
  Console: the next script run replaces each policy's channel list and drops it.
- The relay is one HTTP call per notification with a 5 s Discord timeout;
  Monitoring does not retry a 200, so a Discord outage loses that one embed.
  The incident itself stays in the Console.
- App-error throttling is per Cloud Run instance, so N instances can each post
  the same error once per window.
