# Primary Origins 2 assessment pilot

## Teacher-controlled workflow

- Available only for `Primary Origins 2` (A0), series `PRIMARY-ORIGINS`, catalog `levelNumber: 20`. Reading 2, other Primary levels and demo classes are excluded.
- The tutor opens the class Lobby and selects Lesson, PRE or POST. The activity card only changes that selection; the shared Lobby start button starts either the lesson or the selected assessment. Opening directly uses the first article as its initial lesson; the existing article-selection flow is available before opening the room.
- Students remain in the normal Lobby after PRE or POST is selected, see which activity is coming next, and press Ready. The tutor can start the entire 15-question set only after every connected student is ready. Their class and Progress cards display reports and a join link, without self-service assessment start controls.
- Students work at their own speed. Vocabulary, reading and listening contribute five questions each. Allow approximately 8–10 minutes.
- Each answer is saved on the server before advancing. Reconnecting to the same room restores the draft. The tutor sees answered counts and disconnected students who have saved answers, without seeing individual choices.
- The tutor finishes the set. Only complete drafts receive scores. The UI asks for confirmation before stopping with incomplete students; incomplete drafts remain unscored.
- The tutor can then select Lesson to continue in the same room. Activity changes are blocked while an assessment is running.
- Starting POST permanently closes PRE for that book cycle. Selecting POST alone does not close PRE. Students without completed PRE can take POST, but the report does not calculate growth without a baseline.
- Reports include totals, skill scores, neutral comparisons and student-visible tutor feedback. This pilot sends no guardian reports or LINE notifications.

## Persistence and authorization

One attempt exists per student, book cycle and stage. Completed scores cannot be replaced. Unsubmitted answers are stored in `draft_answers`, scoped to the supervised session. Reopening the same stage in the same room resumes incomplete drafts; the first answer in a new room starts a fresh unsubmitted draft. There is no reset of completed results.

Serializable transactions with bounded retry protect concurrent saves and teacher finish. Revisions reject stale controls. Mutations require a current room lease and Lobby phase. Active enrollment and book access are rechecked for student reads and writes; explicit package revocation overrides original-book fallback. Lesson phase transitions are blocked in the database while assessment mode is selected.

Socket requests use the existing authenticated lesson connection and require acknowledgements:

- `assessment_get`: `{ sessionId }` returns the caller's private snapshot.
- `assessment_control`: `{ sessionId, control: { action: "select", mode: "LESSON" | "PRE" | "POST", revision } }`, or control with `action: "start" | "finish"` and `revision`. Only the current owning tutor socket can control the room.
- `assessment_answer`: `{ sessionId, answer: { revision, questionId, choice } }`. Identity comes from authentication, not the payload. Only the student's active participant socket can save.
- Acknowledgements contain `{ ok: true, state }` or `{ ok: false, message }`. `assessment_updated` broadcasts only `{ sessionId }`, never answers. Clients reconcile every five seconds and on invalidation.

Former HTTP start, submit and open-post endpoints are retired. Authorized supported requests return `409 TEACHER_CONTROLLED`; HTTP summary, report and comment endpoints remain available.

Closing the room does not grade drafts automatically. A stale lease pauses assessment access. Drafts survive reconnection to the same recovered room; a newly created room follows the fresh-draft rule above.

## Pilot content and interpretation

The new bank uses Thai instructions for vocabulary and listening, five basic word meanings, a short present-tense story, and five single-sentence listening items. Vocabulary and listening target the same concepts in both forms with reordered choices; reading checks person, object, color, size and place. Content was aligned with the local sentence manifests for Pip the Curious Puppy Feels, Pip Sees Food and Lily Goes to School. The previous Reading 2 audio remains available under its old version; existing results are not rewritten. No database migration is needed for this catalog/content correction.

Both forms are newly authored in `services/learning-service/src/services/origins2Assessment.ts`. Form A is PRE and B is POST. They share a skill blueprint but are not standardized or empirically equated. Have an instructor review wording, answer keys, audio clarity, difficulty and alignment with the workbook before classroom use. Scores are a preliminary within-book signal, not CEFR certification or a tutor compensation input. Five items per skill provide a coarse signal.

Reading passages and listening scripts are newly authored. Audio replays are allowed on both forms; use comparable listening conditions. Administer PRE before teaching the book; the system does not infer whether prior learning has occurred.

Version `primary-origins2-v1` and its ten bundled WAV recordings must remain immutable after collecting results. Recordings use Microsoft Zira Desktop at rate -1. The Windows script `scripts/generate-assessment-audio.ps1` documents generation; publish a new version when changing content or audio.

## Release and verification

Apply both migrations through the normal deployment pipeline before deploying the new service and apps:

```sh
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

Do not use `db push`. Migration `20260907090000_origins2_assessments` creates assessment tables. Migration `20260907100000_teacher_led_assessments` adds session controls and persistent drafts. Existing lesson scores and enrollment data are unchanged. Deleting a book cycle cascades to its assessments.

```sh
npm test
npm run contract:check
npm run lint
npm run build:services
npm run build
```

`tests/integration/assessment.test.ts` covers teacher selection/start, concurrent saves, complete-only finalization, return to Lesson and POST without a baseline. Run `npm run test:integration -- tests/integration/assessment.test.ts` only against a dedicated migrated PostgreSQL test database. A skipped suite is not evidence of database correctness.

Manual acceptance: open a Primary Origins 2 Lobby with two student accounts; select PRE and verify both remain in the normal Lobby with the upcoming activity shown; verify the shared start button remains disabled until both students press Ready; start from that button; answer at different speeds; reconnect one student; verify private answer recovery and teacher counts; finish with one incomplete student and verify only the complete student gets a score. Return to Lesson. In a later Lobby start POST and verify PRE is closed, then verify paired reports and feedback. Test audio inside LINE on pilot devices.
