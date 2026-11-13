import { describe, expect, it } from "vitest";

import { lessonSessionService as service, VOCABULARY_GAME_PHASE } from "../services/LessonSessionService";
import { planBusMessages, splitBusPayload } from "./LessonSocketBus";

const sizeUnder = (limit: number) => (part: unknown) => JSON.stringify(part).length <= limit;

describe("splitBusPayload", () => {
  it("sends a payload that fits as it is", () => {
    const payload = { participants: [{ studentId: "a" }] };
    expect(splitBusPayload(payload, sizeUnder(1_000))).toEqual([payload]);
  });

  it("splits a large roster into parts that fit and together hold every student", () => {
    const participants = Array.from({ length: 30 }, (_, i) => ({ studentId: `student-${i}`, name: "น้องนักเรียน", pictureUrl: "x".repeat(150) }));
    const parts = splitBusPayload({ participants, phaseVersion: 7 }, sizeUnder(2_000)) as Array<{ participants: unknown[]; phaseVersion: number }>;

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(JSON.stringify(part).length).toBeLessThanOrEqual(2_000);
      expect(part.phaseVersion).toBe(7);
    }
    expect(parts.flatMap((part) => part.participants)).toEqual(participants);
  });

  it("splits a game state's results and keeps the rest of the state in each part", () => {
    const results = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`s${i}`, { studentId: `s${i}`, score: i % 10, name: "x".repeat(60) }]));
    const gameState = { phase: 10, status: "results", playingStartedAt: 5, results };
    const parts = splitBusPayload({ gameState }, sizeUnder(1_500)) as Array<{ gameState: typeof gameState }>;

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.gameState).toMatchObject({ phase: 10, status: "results", playingStartedAt: 5 });
    }
    expect(Object.assign({}, ...parts.map((part) => part.gameState.results))).toEqual(results);
  });

  it("sends a large phase change whole, with its results as a game update the receiver merges", () => {
    service.resetForTest();
    const results: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) {
      const id = `student-${i}`;
      results[id] = { studentId: id, name: "นักเรียนคนที่ " + i, gameId: "dragon-flight", score: 10, correct: 10, total: 10, durationMs: 60000, submittedAt: 1 };
    }
    const payload = {
      phase: VOCABULARY_GAME_PHASE, phaseVersion: 30, phaseChangeId: "rewind", phaseRestored: true, resumePhase: 12,
      gameState: { phase: VOCABULARY_GAME_PHASE, category: "vocabulary", status: "results", votes: {}, voteFirstSeen: {}, selectedGameId: "dragon-flight", playingStartedAt: 123, results },
    };
    const fits = (event: string, part: unknown) => JSON.stringify({ event, payload: part }).length <= 3_000;

    const messages = planBusMessages("phase_changed", payload, fits);
    expect(messages.filter((message) => message.event === "phase_changed")).toHaveLength(1);
    expect(messages.length).toBeGreaterThan(2);

    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.setPhase(session.sessionId, 12);
    session.phaseVersion = 29;
    for (const message of messages) service.applyRemoteEvent(session.sessionId, message.event, message.payload, { scoreClock: true });

    expect(session.currentPhase).toBe(VOCABULARY_GAME_PHASE);
    expect(Object.keys(session.gameState?.results ?? {})).toHaveLength(40);
  });

  it("never splits an event whose receivers apply it once", () => {
    const fits = (_event: string, part: unknown) => JSON.stringify(part).length <= 100;
    expect(planBusMessages("tutor_away", { since: 1, note: "x".repeat(200) }, fits)).toEqual([]);
  });

  it("gives up only when a single student does not fit", () => {
    expect(splitBusPayload({ participants: [{ note: "x".repeat(500) }] }, sizeUnder(100))).toEqual([]);
  });
});
