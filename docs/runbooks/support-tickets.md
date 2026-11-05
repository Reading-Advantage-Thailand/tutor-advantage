# Support tickets (คำร้อง) — operator runbook

Students (LINE LIFF → Profile → help group) and tutors (tutor PWA → More menu
→ support) open requests in the app. Operators work them in the
admin console under **คำร้อง** (`/support/tickets`). Every case in
`student-service-requests.md` is recorded here, and the **ticket number
(`#123`) is the case reference** you quote to the requester, finance and the
tutor.

Code: `services/learning-service` (`/v1/tickets…`, `/v1/admin/tickets…`),
tables `learning.support_tickets` and `learning.support_ticket_messages`
(migration `20261105090000_support_tickets`). Clients:
`apps/admin-console/src/app/support/tickets`, `apps/student-liff` `/support`,
`apps/tutor-pwa` `/dashboard/support`. No attachments in v1.

## Statuses

| Status | Admin label | Requester sees | Meaning |
|---|---|---|---|
| `OPEN` | รอทีมงาน | รอทีมงาน | New, or the requester wrote again. Waiting for us. |
| `IN_PROGRESS` | กำลังดำเนินการ | กำลังดำเนินการ | We replied or are working it. Set automatically by the first public reply on an `OPEN` ticket. |
| `WAITING_ON_REQUESTER` | รอผู้แจ้ง | รอข้อมูลจากคุณ | We need something from the requester. Their next message moves it back to `OPEN`. |
| `RESOLVED` | ปิดแล้ว | ปิดแล้ว | Done, by us or by the requester ("ปิดคำร้อง"). |

- A requester can reply to a `RESOLVED` ticket for **14 days** after it was
  resolved; that reopens it as `OPEN`. After 14 days the thread is read-only
  for them (`TICKET_CLOSED`) and they open a new ticket. Link the old number in
  an internal note on the new one.
- Every status change is shown in the thread as a status line, to both sides.
- Setting the same status again does nothing.
- **Awaiting support** (`awaitingSupport`) is the real "ball is in our court" flag:
  true on creation and after every requester message or reopen, false after
  our public reply or when the status becomes รอผู้แจ้ง / ปิดแล้ว. The sidebar
  badge on คำร้อง and the overview work queue count these tickets.

## Categories and first-response deadlines

The deadline (`dueAt`) is for the **first public reply**,
not for solving the case. It is the end of the Nth business day (Mon–Fri,
Bangkok time, 23:59) after the day the ticket was created. Thai public holidays
are **not** excluded, so treat a deadline that falls on a holiday as the
working day before it.

| Code | Label | Who | First reply | Commitment in `student-service-requests.md` |
|---|---|---|---|---|
| `REFUND` | คืนเงิน/ยกเลิก | student | 3 business days | Decision within 3 business days of receiving class, payment reference and proof of payment; refund processed within 7 business days of approval. |
| `BOOK_DELIVERY` | หนังสือยังไม่ได้รับ/ส่งช้า | student, tutor | 2 business days | Revised handover date within 2 business days of the report; book delivered within 7 business days. |
| `BOOK_DAMAGED` | หนังสือชำรุด/ผิดเล่ม | student | 2 business days | Replacement through the tutor within 7 business days (report with photo within 7 days of receipt). |
| `CLASS` | คลาสเรียน/ตารางเรียน | student, tutor | 2 business days | — (if the company cannot open the class, handle as `REFUND`). |
| `PAYOUT` | การจ่ายเงินติวเตอร์ | tutor | 2 business days | See `settlement-runbook.md` / `payout-incident-response.md`. |
| `PRIVACY` | ข้อมูลส่วนตัว/ลบบัญชี | student, tutor | 2 business days | Privacy, access and account-closure steps (restricted case). |
| `TECHNICAL` | ปัญหาการใช้งานแอป | student, tutor | 2 business days | — |
| `OTHER` | อื่นๆ | student, tutor | 2 business days | — |

A ticket is **overdue** when it is not resolved, has no public
reply yet and the deadline has passed. Once you have replied it is never
overdue again, so keep the later commitments (decision, refund, delivery
dates) yourself: write the promised date in an internal note and in the
public reply. If the requester picked the wrong category, say so in an
internal note; the category cannot be changed in v1.

Requester limits (they see a Thai message): at most 5 unresolved tickets, 10
new tickets per 24 hours and 30 messages per hour across their tickets.

## Working the queue

1. Open คำร้อง. The default view shows every unresolved ticket, sorted by
   deadline, earliest first. Work the overdue filter first, then awaiting
   support. Search by `#123` (exact number), subject, requester name or email.
2. Open a ticket and assign it to yourself (assign to me) so others skip it.
   Re-assigning or un-assigning is allowed; only ADMIN accounts can be assignees.
3. Check the context shown on the ticket: requester role and email, the linked
   class (only a class the requester is enrolled in / teaches can be linked)
   and payment reference. Verify against the payment / enrollment pages before
   promising anything, as `student-service-requests.md` requires.
4. Reply. A **public reply** is sent to the requester; an **internal note**
   is visible only in the admin console. The composer can set a
   status in the same action, e.g. reply and move to รอผู้แจ้ง when you ask
   for a payment reference.
5. Resolve with ปิดแล้ว when the case is complete. Add an internal note with
   the outcome (decision, approver, refund/transfer reference, completion
   date) — that note is the case record.

Status changes and assignments are written to the audit log
(`finance_mlm.audit_events`) with the acting admin.

### Internal notes vs public replies

- Public replies: Thai, polite, no internal names, no other learner's or
  tutor's information, no dates you cannot meet. The requester sees "ทีมงาน",
  never your name.
- Internal notes: decisions, approver, references, links to Omise/finance
  records, why an exception was made. They never reach the requester and never
  change the status or the awaiting-support flag.
- A note added with a status change (the optional note field) is stored as an
  internal note.

### What never goes into a ticket

Neither side may paste, and you must never ask for:

- passwords, OTPs, LINE login codes;
- full card numbers, CVV, card expiry;
- full bank account numbers in a public reply. For a PromptPay refund, ask
  privately as described in `student-service-requests.md` and record only the
  bank and last 4 digits in an internal note;
- ID card / passport numbers or photos (no attachments exist anyway).

If a requester pastes one of these, do not quote it back. Reply asking them
not to send it again, and ask a database operator to blank that message body
(there is no in-app delete in v1); note in an internal note that it was
removed, without repeating the value.

**Privacy cases (`PRIVACY`)** are restricted: keep the thread to what is
needed to verify control of the account and confirm the request. Record the
data categories, exceptions and operator in internal notes, per the privacy
section of `student-service-requests.md`. Do not discuss the requester's data
with other staff outside the ticket.

## Notifications

- **New ticket → Discord** (only if `DISCORD_TICKETS_WEBHOOK_URL` is set):
  embed `คำร้องใหม่ #<n>` with category, requester role and deadline, and a
  link to the ticket when `ADMIN_CONSOLE_URL` is set. It never contains the
  subject, message, names, emails or ids: Discord is a third party. It does
  **not** fall back to `DISCORD_WEBHOOK_URL` (the shared ops alert channel).
- **Our public reply, or status → รอผู้แจ้ง / ปิดแล้ว → LINE** push to the
  requester: "ทีมงานตอบคำร้อง #<n> แล้ว" plus a link, never the reply text.
  Students get a LIFF deep link to `/support/<id>` (needs `LIFF_URL`); tutors
  get `${TUTOR_PWA_URL}/dashboard/support/<id>` (no link without
  `TUTOR_PWA_URL`). The push respects the requester's LINE message preference
  (`notifyLineMessages`); requesters who turned it off, or have no LINE
  account linked, still see the unread badge in the app.
- Internal notes and assignments send nothing.
- Notifications are fire-and-forget: a LINE or Discord failure is logged as a
  warning and never blocks the reply. If a requester says they got no LINE
  message, the reply is still in the app.

## Production setup

1. **Migration** `20261105090000_support_tickets` runs with the deploy
   (`tutor-advantage-db-migrate`).
2. **Discord channel for tickets** (optional; without it there is no Discord
   post). Create a webhook in a support channel (not the ops alert channel),
   then store it and let the learning runtime SA read it **before** mounting
   it:
   ```bash
   printf '%s' 'https://discord.com/api/webhooks/…' | \
     gcloud secrets create ta-discord-tickets-webhook-url --project=reading-advantage \
       --replication-policy=automatic --data-file=-
   gcloud secrets add-iam-policy-binding ta-discord-tickets-webhook-url --project=reading-advantage \
     --member="serviceAccount:ta-learning-run@reading-advantage.iam.gserviceaccount.com" \
     --role=roles/secretmanager.secretAccessor
   gcloud run services update learning-service --region=asia-southeast1 --project=reading-advantage \
     --update-secrets=DISCORD_TICKETS_WEBHOOK_URL=ta-discord-tickets-webhook-url:latest
   ```
   A revision whose SA cannot read a mounted secret fails to start, so the
   grant comes first. `deploy.yml` uses `--update-secrets`, which keeps this
   mount on later deploys.
3. **Link targets** (plain env vars, not secrets) on learning-service:
   ```bash
   gcloud run services update learning-service --region=asia-southeast1 --project=reading-advantage \
     --update-env-vars=ADMIN_CONSOLE_URL=https://<admin-console-host>,TUTOR_PWA_URL=https://<tutor-pwa-host>
   ```
   No trailing slash. Also check `LIFF_URL` and `LINE_CHANNEL_ACCESS_TOKEN`
   are set (see `scheduled-reminders.md`).
4. **Smoke test** with a synthetic student account: open a ticket in LIFF,
   check the Discord embed has no subject/body, reply from the admin console,
   check the LINE push and its link, then resolve.

### Optional: daily overdue digest (not created yet)

`POST /v1/internal/tickets/overdue-digest` (header `X-Internal-Key`) counts
overdue and awaiting-support tickets and, when at least one is overdue and
`DISCORD_TICKETS_WEBHOOK_URL` is set, posts one embed with the counts only.
It returns `{ overdue, awaitingSupport, posted }`. The job definition is in
`infra/cloud-scheduler/ticket-overdue-digest-cron.yaml` (09:00 Asia/Bangkok
daily). **It has not been created in production.** To create it (learning-service
already mounts `INTERNAL_API_KEY`):

```bash
LEARNING_URL=$(gcloud run services describe learning-service \
  --region=asia-southeast1 --project=reading-advantage --format='value(status.url)')
KEY=$(gcloud secrets versions access latest --secret=ta-internal_api_key --project=reading-advantage)

gcloud scheduler jobs create http ta-ticket-overdue-digest \
  --schedule="0 9 * * *" --time-zone="Asia/Bangkok" \
  --uri="${LEARNING_URL}/v1/internal/tickets/overdue-digest" \
  --http-method=POST \
  --headers="X-Internal-Key=${KEY},Content-Type=application/json" \
  --message-body='{}' \
  --attempt-deadline=60s --max-retry-attempts=2 \
  --min-backoff=60s --max-backoff=300s --max-doublings=2 \
  --location=asia-southeast1 --project=reading-advantage
unset KEY
```

The `ta-` prefix puts it under the `TA: Cloud Scheduler job failed` alert
(`monitoring-alerts.md`). Test once with `gcloud scheduler jobs run
ta-ticket-overdue-digest --location=asia-southeast1`. After rotating
`ta-internal_api_key`, update the job's header too.
