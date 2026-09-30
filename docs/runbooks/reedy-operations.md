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
  `voiceUsage.ts` (reviewed 2026-09-30). Cached text/audio/image input is priced
  separately. Usage is snapshotted before the provider call is hung up, so the
  sideband closing afterwards does not discard it. A session counts as missing
  only when a response was still running when the call ended, or when the
  sideband was re-attached after a service restart. The dashboard reports that
  missing count explicitly.
- **Measured transcription cost**: learner speech transcribed by
  `gpt-transcribe` at USD 0.0045 per minute. Each
  `conversation.item.input_audio_transcription.completed` event reports
  `usage.type = "duration"` with billed seconds; if a provider only reports
  tokens, the VAD speech boundaries are used instead. Sessions recorded before
  2026-09-30 have no transcription amount and are counted separately.
  Rate card: https://developers.openai.com/api/docs/pricing . Usage event shape:
  https://developers.openai.com/api/docs/guides/voice-latency-cost .

The dashboard total is Realtime plus transcription. It is **not the final
provider bill**: moderation (`omni-moderation-latest`, currently free), the
fallback Gemini evaluator, and later price changes are not included. Compare the
dashboard trend with the provider's project billing totals after rollout.
Update both rate cards whenever the configured models or published pricing
change. A local simulation on 2026-09-30 measured about USD 0.028 per practice
minute on `gpt-realtime-2.1-mini`, higher than the
`AI_VOICE_ESTIMATED_COST_THB_PER_MINUTE=0.5` estimate used for the package
cost warning.

Per-turn guidance is sent as a `system` conversation item, never as
`response.create` `instructions`: those replace the session prompt (lesson
context, persona, safety rules) for that response.

If start failures rise, check provider call creation errors and WebRTC setup.
If disconnects rise, compare affected clients and networks. If summaries fail,
check sideband availability and the fallback evaluator logs. Do not log raw
learner transcripts while investigating.
