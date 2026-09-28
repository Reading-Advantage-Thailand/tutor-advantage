# Reedy voice operations

Admin Console → การฝึกเสียงกับรีดี้ shows a 7, 30, or 90 day view. The API is
`GET /v1/admin/voice-operations?days=30` and requires an active `ADMIN` user.
It returns aggregate counts and recent session identifiers, without student
names, audio, or transcripts.

- **Start failure**: a reserved session where the provider call failed or the
  connection lease/timeout expired before WebRTC was acknowledged. Microphone permission
  errors before a reservation are not in this denominator.
- **Disconnect**: a connected, ended session marked `CONNECTION_LOST` by the
  student client. Page closure and user end are separate reasons.
- **Summary failure**: a connected, ended session without persisted feedback.
- **Measured Realtime cost**: sum of all provider `response.done` token usage
  observed by the server sideband, priced in USD using the model rate card in
  `voiceUsage.ts` (reviewed 2026-09-28). Cached text/audio/image input is priced
  separately. The dashboard excludes sessions whose usage is missing or may be
  incomplete after a service restart. It reports that missing count explicitly.
  Rate card: https://developers.openai.com/api/docs/pricing . Usage event shape:
  https://developers.openai.com/api/docs/guides/voice-latency-cost .

The measured Realtime amount is **not the final provider bill**. Input
transcription uses `gpt-transcribe` and is billed separately; its audio duration
is not available as a per-session billing amount in these events. Moderation or
other provider charges and later price changes may also affect the bill. Compare
the dashboard trend with the provider's project billing totals after rollout.
Update the rate card whenever the configured model or published pricing changes.

If start failures rise, check provider call creation errors and WebRTC setup.
If disconnects rise, compare affected clients and networks. If summaries fail,
check sideband availability and the fallback evaluator logs. Do not log raw
learner transcripts while investigating.
