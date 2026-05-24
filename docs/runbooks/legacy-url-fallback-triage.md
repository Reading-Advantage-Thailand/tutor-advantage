# Runbook: Referral Fallback Triage

**Service:** `learning-service`  
**Owner:** Engineering  
**Audience:** On-call engineer, Support team

---

## Overview

When a student uses a referral link for a class that is **full or closed**, the system
automatically places them in another open class by the same tutor (fallback placement).
If no fallback class is available, enrollment is rejected with `CLASS_FULL`.

The student sees an amber banner in the LIFF app when fallback placement occurs:

> "คลาสนี้เต็มแล้ว — ระบบจะจัดหาคลาสอื่นของติวเตอร์เดิมให้คุณโดยอัตโนมัติ"

---

## Trigger Conditions

| Scenario | Expected behaviour |
|---|---|
| Primary class is `OPEN` and has capacity | Enrolled in primary class, `placement=PRIMARY` |
| Primary class is full (`enrolledCount >= capacity`) | Auto-placed in fallback, `placement=FALLBACK` |
| Primary class is `CLOSED` | Auto-placed in fallback, `placement=FALLBACK` |
| No open fallback class exists for the tutor | 400 `CLASS_FULL` — student cannot enroll |
| Referral token is invalid or `status != ACTIVE` | 400 `REFERRAL_INVALID` |

---

## Diagnosing a Complaint ("I was placed in the wrong class")

### Step 1 — Find the enrollment

```sql
-- Via referral token (from the URL ?token=<referralToken>)
SELECT
  e.enrollment_id,
  e.class_id,
  e.student_user_id,
  e.referral_token,
  e.status,
  e.created_at,
  r.class_id AS referral_class_id
FROM learning.enrollments e
LEFT JOIN learning.referrals r ON e.referral_token = r.token
WHERE e.student_user_id = '<studentUserId>'
ORDER BY e.created_at DESC
LIMIT 5;
```

### Step 2 — Check if fallback was triggered

Compare `enrollment.class_id` vs `referral.class_id`.  
If they differ → fallback was triggered.

### Step 3 — Verify primary class state at enrollment time

```sql
SELECT class_id, status, enrolled_count, capacity, tutor_user_id
FROM learning.classes
WHERE class_id = '<referralClassId>';
```

If `enrolled_count >= capacity` or `status != 'OPEN'` → fallback was correct.

### Step 4 — Find the fallback class selected

```sql
-- The fallback class is the enrollment's current class_id
SELECT class_id, title, status, enrolled_count, capacity
FROM learning.classes
WHERE class_id = '<enrollmentClassId>';
```

---

## Common Issues and Fixes

### Issue: Student complains about being in wrong class but primary had capacity

**Possible cause:** A race condition — two students enrolled simultaneously and one bumped the count over capacity.  
**Check:** `enrolled_count` at time of enrollment (check audit logs / `created_at` of other enrollments in the same class at the same time).  
**Fix:** If primary was actually not full, manually update the enrollment's `class_id` back to the primary class and decrement fallback `enrolled_count`, increment primary `enrolled_count`. Requires Finance to re-check if payment is associated.

### Issue: `CLASS_FULL` even though the tutor has other open classes

**Possible cause:** Other classes exist but `status != 'OPEN'` or `enrolled_count >= capacity`.

```sql
SELECT class_id, title, status, enrolled_count, capacity
FROM learning.classes
WHERE tutor_user_id = '<tutorUserId>'
  AND status = 'OPEN'
  AND enrolled_count < capacity;
```

If this returns no rows → the tutor has no available classes. Ask tutor to open a new class.

### Issue: Referral token gives `REFERRAL_INVALID`

```sql
SELECT token, status, class_id, created_at
FROM learning.referrals
WHERE token = '<token>';
```

- If `status = 'INACTIVE'` or row missing → token was deactivated or never created.  
- Ask the tutor to generate a new referral from their dashboard.

---

## Manually Correcting an Enrollment Class

> ⚠️ Only do this if the student consents and payment is not yet linked, or Finance has approved the correction.

```sql
BEGIN;

-- Update enrollment to correct class
UPDATE learning.enrollments
SET class_id = '<correctClassId>'
WHERE enrollment_id = '<enrollmentId>';

-- Fix enrolled_count on the wrong class (decrement)
UPDATE learning.classes
SET enrolled_count = GREATEST(0, enrolled_count - 1)
WHERE class_id = '<wrongClassId>';

-- Fix enrolled_count on the correct class (increment)
UPDATE learning.classes
SET enrolled_count = enrolled_count + 1
WHERE class_id = '<correctClassId>';

COMMIT;
```

After this, the payment is still linked to the correct `enrollmentId` — the `class_id` change is transparent to the payment flow.

---

## Monitoring

- Check for high `CLASS_FULL` error rates in Cloud Logging:

```
resource.type="cloud_run_revision"
resource.labels.service_name="learning-service"
jsonPayload.error.code="CLASS_FULL"
```

- If a tutor's class fills up repeatedly, proactively reach out to ask them to open additional sections.

---

## Escalation

1. **Support** → first-level triage using Step 1–4
2. **Engineering** → if DB correction is needed
3. **Finance** → if a correction affects a paid enrollment

---

## Related

- [Settlement Runbook](./settlement-runbook.md)
- `services/learning-service/src/controllers/enrollmentController.ts`
- `apps/student-liff/src/app/enroll/page.tsx` — fallback UI banner
