import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPREHENSION_PHASE,
  GUIDED_RESPONSE_PHASE,
  KEY_SENTENCES_PHASE,
  SENTENCE_GAME_PHASE,
  VOCABULARY_GAME_PHASE,
  lessonSessionService as service,
} from "./LessonSessionService";

describe("lessonSessionService", () => {
  beforeEach(() => {
    service.resetForTest();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("creates sessions, indexes them by class, and reuses active class sessions", () => {
    const articleData = {
      multipleChoiceQuestions: [{ question: "Q1" }],
      shortAnswerQuestions: [{ question: "S1" }],
      words: ["apple"],
      sentences: ["A long enough sentence here"],
    };

    const first = service.createSession("tutor-1", "socket-1", "article-1", articleData, "class-1");
    const recovered = service.createSession("tutor-1", "socket-2", "article-1", articleData, "class-1");

    expect(service.getSessionByClassId("class-1")).toBe(first);
    expect(recovered).toBe(first);
    expect(recovered.tutorSocketId).toBe("socket-2");
  });

  it("deduplicates phase events and keeps an older tutor owner from taking over", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, 3);
    const phaseChangeId = session.phaseChangeId;

    service.applyRemoteEvent(session.sessionId, "phase_changed", {
      phase: 2,
      phaseChangeId,
    });
    expect(session.currentPhase).toBe(3);

    const currentOwnerVersion = session.tutorOwnerVersion;
    service.applyRemoteEvent(session.sessionId, "tutor_owner_changed", {
      tutorSocketId: "socket-new",
      tutorOwnerVersion: currentOwnerVersion + 1,
    });
    service.applyRemoteEvent(session.sessionId, "tutor_owner_changed", {
      tutorSocketId: "socket-old",
      tutorOwnerVersion: currentOwnerVersion,
    });

    expect(session.tutorSocketId).toBe("socket-new");
  });

  it("keeps participant score and readiness when a student reconnects", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.toggleReady(session.sessionId, "student-1");
    session.participants.get("student-1")!.score = 10;
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-b", "avatar.png");

    expect(session.participants.get("student-1")).toMatchObject({
      socketId: "socket-b",
      score: 10,
      isReady: true,
      pictureUrl: "avatar.png",
    });
  });

  it("resets answer state on phase changes and reports when all participants answered", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.joinSessionByClassId("class-1", "student-2", "Bob", "socket-b");

    service.setPhase(session.sessionId, 1);
    const first = service.submitAnswer(session.sessionId, "student-1", "  yes  ");
    const second = service.submitAnswer(session.sessionId, "student-2", "no");

    expect(first?.allAnswered).toBe(false);
    expect(first?.accepted).toBe(true);
    expect(second?.allAnswered).toBe(true);
    expect(session.participants.get("student-1")?.latestAnswer).toBe("yes");

    const replay = service.submitAnswer(session.sessionId, "student-1", "forged replay");
    expect(replay?.accepted).toBe(false);
    expect(session.participants.get("student-1")?.latestAnswer).toBe("yes");

    service.setPhase(session.sessionId, 2);
    expect(session.participants.get("student-1")).toMatchObject({
      hasAnsweredCurrentPhase: false,
      latestAnswer: undefined,
    });
    expect(session.status).toBe("ACTIVE");
  });

  it("reserves an answer before a slow evaluator and rejects concurrent duplicates", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.setPhase(session.sessionId, GUIDED_RESPONSE_PHASE);

    const reservation = service.reserveAnswer(session.sessionId, "student-1");
    expect(reservation?.accepted).toBe(true);
    expect(session.participants.get("student-1")?.hasAnsweredCurrentPhase).toBe(true);
    expect(session.participants.get("student-1")?.latestAnswer).toBeUndefined();

    const duplicate = service.reserveAnswer(session.sessionId, "student-1");
    expect(duplicate?.accepted).toBe(false);

    const completed = service.completeReservedAnswer(session.sessionId, "student-1", "evaluated");
    expect(completed?.accepted).toBe(true);
    expect(session.participants.get("student-1")?.latestAnswer).toBe("evaluated");
  });

  it("rolls back an answer reservation when processing fails before commit", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.setPhase(session.sessionId, GUIDED_RESPONSE_PHASE);

    expect(service.reserveAnswer(session.sessionId, "student-1")?.accepted).toBe(true);
    expect(service.releaseReservedAnswer(session.sessionId, "student-1")).toBe(true);
    expect(session.participants.get("student-1")).toMatchObject({
      hasAnsweredCurrentPhase: false,
      latestAnswer: undefined,
    });
    expect(service.reserveAnswer(session.sessionId, "student-1")?.accepted).toBe(true);
  });

  it("applies remote phase and participant events to a recovered instance", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.applyRemoteEvent(session.sessionId, "phase_changed", {
      phase: GUIDED_RESPONSE_PHASE,
      phaseVersion: 0,
      phaseChangeId: "legacy-phase",
      phaseSelectedIndices: { [GUIDED_RESPONSE_PHASE]: 2 },
      currentDbSessionId: "cycle-1",
      phaseRestored: false,
    });
    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{
        studentId: "student-1",
        name: "Ada Updated",
        score: 7,
        hasAnsweredCurrentPhase: true,
        latestAnswer: "answer",
        isReady: true,
      }],
    });

    expect(session).toMatchObject({
      currentPhase: GUIDED_RESPONSE_PHASE,
      currentDbSessionId: "cycle-1",
      phaseSelectedIndices: { [GUIDED_RESPONSE_PHASE]: 2 },
    });
    expect(session.participants.get("student-1")).toMatchObject({
      name: "Ada Updated",
      score: 7,
      hasAnsweredCurrentPhase: true,
      latestAnswer: "answer",
      socketId: "socket-a",
    });
  });

  it("keeps the synchronized game payload when applying a versioned phase event", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.applyRemoteEvent(session.sessionId, "phase_changed", {
      phase: VOCABULARY_GAME_PHASE,
      phaseVersion: 1,
      gameState: {
        phase: VOCABULARY_GAME_PHASE,
        category: "vocabulary",
        status: "voting",
        votes: {},
        results: {},
        voteFirstSeen: {},
      },
    });

    expect(session.currentPhase).toBe(VOCABULARY_GAME_PHASE);
    expect(session.phaseVersion).toBe(1);
    expect(session.gameState).toMatchObject({
      phase: VOCABULARY_GAME_PHASE,
      category: "vocabulary",
      status: "voting",
    });
  });

  it("reconciles a stale local phase from persisted state and rejects older events", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    const reconciled = service.reconcileRestoredState(session.sessionId, {
      currentPhase: GUIDED_RESPONSE_PHASE,
      phaseVersion: 8,
      activeSentenceIndex: 2,
      phaseSelectedIndices: { [KEY_SENTENCES_PHASE]: 1, [GUIDED_RESPONSE_PHASE]: 0 },
      currentDbSessionId: "cycle-1",
    });

    expect(reconciled).toBe(session);
    expect(session).toMatchObject({
      currentPhase: GUIDED_RESPONSE_PHASE,
      phaseVersion: 8,
      activeSentenceIndex: 2,
      currentDbSessionId: "cycle-1",
    });

    session.participants.get("student-1")!.hasAnsweredCurrentPhase = true;
    session.participants.get("student-1")!.latestAnswer = "new answer";
    service.applyRemoteEvent(session.sessionId, "phase_changed", {
      phase: KEY_SENTENCES_PHASE,
      phaseVersion: 7,
      phaseChangeId: "older-transition",
    });

    expect(session.currentPhase).toBe(GUIDED_RESPONSE_PHASE);
    expect(session.phaseVersion).toBe(8);

    service.reconcileRestoredState(session.sessionId, {
      currentPhase: KEY_SENTENCES_PHASE,
      phaseVersion: 8,
    });
    expect(session.currentPhase).toBe(GUIDED_RESPONSE_PHASE);
  });

  it("restores the full transition state after a failed phase commit", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.setPhase(session.sessionId, KEY_SENTENCES_PHASE);
    session.participants.get("student-1")!.score = 17;
    const snapshot = service.captureTransitionState(session.sessionId)!;

    service.setPhase(session.sessionId, GUIDED_RESPONSE_PHASE);
    service.restoreTransitionState(session.sessionId, snapshot);

    expect(session).toMatchObject({
      currentPhase: KEY_SENTENCES_PHASE,
      phaseVersion: snapshot.phaseVersion,
      phaseChangeId: snapshot.phaseChangeId,
    });
    expect(session.participants.get("student-1")).toMatchObject({
      score: 17,
      socketId: "socket-a",
    });
  });

  it("rewinds to the last saved phase state without losing score or answers", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    service.setPhase(session.sessionId, 1);
    service.submitAnswer(session.sessionId, "student-1", "saved answer");
    session.participants.get("student-1")!.score = 12;
    service.setPhase(session.sessionId, 2);

    const rewound = service.rewindPhase(session.sessionId, 1);

    expect(rewound).toBe(session);
    expect(session).toMatchObject({
      currentPhase: 1,
      phaseRestored: true,
      resumePhase: 2,
      status: "ACTIVE",
    });
    expect(session.participants.get("student-1")).toMatchObject({
      score: 12,
      hasAnsweredCurrentPhase: true,
      latestAnswer: "saved answer",
    });
  });

  it("does not rewind before Phase 1 or without a saved checkpoint", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    expect(service.rewindPhase(session.sessionId, 0)).toBeUndefined();
    service.setPhase(session.sessionId, 5);
    expect(service.rewindPhase(session.sessionId, 4)).toBeUndefined();
  });

  it("rejects review mutations on the server-side session", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    service.setPhase(session.sessionId, COMPREHENSION_PHASE);
    service.setPhase(session.sessionId, GUIDED_RESPONSE_PHASE);
    expect(service.rewindPhase(session.sessionId, COMPREHENSION_PHASE)).toBe(session);

    expect(service.toggleReady(session.sessionId, "student-1")).toBeUndefined();
    expect(service.submitAnswer(session.sessionId, "student-1", "answer")).toBeUndefined();
    expect(service.toggleSentenceFlag(session.sessionId, "student-1", 0)).toBeUndefined();
    expect(service.startGameVote(session.sessionId, VOCABULARY_GAME_PHASE)).toBeNull();
    expect(service.submitGameVote(session.sessionId, "student-1", "dragon-flight")).toBeNull();
    expect(service.submitGameResult(session.sessionId, "student-1", { score: 10 })).toBeNull();
  });

  it("removes participants and deletes all session indexes", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    expect(service.removeParticipantBySocketId("socket-a")).toEqual({
      sessionId: session.sessionId,
      studentId: "student-1",
    });
    expect(service.deleteSession(session.sessionId)).toBe(true);
    expect(service.getSession(session.sessionId)).toBeUndefined();
    expect(service.getSessionByClassId("class-1")).toBeUndefined();
  });

  it("creates independent game phases for vocabulary and sentence rounds", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.joinSessionByClassId("class-1", "student-2", "Bob", "socket-b");

    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    expect(session.gameState).toMatchObject({ phase: VOCABULARY_GAME_PHASE, category: "vocabulary", status: "voting" });

    service.submitGameVote(session.sessionId, "student-1", "dragon-flight");
    service.submitGameVote(session.sessionId, "student-2", "dragon-flight");
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-flight");
    service.markGamePlaying(session.sessionId);
    const first = service.submitGameResult(session.sessionId, "student-1", {
      gameId: "dragon-flight",
      score: 8,
      correct: 4,
      total: 5,
    });
    const duplicate = service.submitGameResult(session.sessionId, "student-1", {
      gameId: "dragon-flight",
      score: 8,
    });
    expect(first?.accepted).toBe(true);
    expect(first?.allSubmitted).toBe(false);
    expect(first?.gameState.status).toBe("playing");
    expect(duplicate?.accepted).toBe(false);
    expect(first?.gameState.results["student-1"]?.score).toBe(8);
    expect(session.participants.get("student-1")?.score).toBe(8);

    const second = service.submitGameResult(session.sessionId, "student-2", {
      gameId: "dragon-flight",
      score: 10,
      correct: 5,
      total: 5,
    });
    expect(second?.accepted).toBe(true);
    expect(second?.allSubmitted).toBe(true);
    expect(second?.gameState.status).toBe("results");
    expect(session.participants.get("student-1")?.score).toBe(8);
    expect(session.participants.get("student-2")?.score).toBe(10);

    service.setPhase(session.sessionId, SENTENCE_GAME_PHASE);
    expect(session.gameState).toMatchObject({ phase: SENTENCE_GAME_PHASE, category: "sentence", status: "voting" });
    expect(session.gameState?.results).toEqual({});
  });

  it("falls back to default games when no one votes", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-flight");

    service.setPhase(session.sessionId, SENTENCE_GAME_PHASE);
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("castle-defense");
  });

  it("ignores votes for locked games", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    expect(service.submitGameVote(session.sessionId, "student-1", "alchemists-synthesis")).toBeNull();
    expect(session.gameState?.votes).toEqual({});
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-flight");
  });

  it("supports an optional teacher demo and tutorial before the countdown", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    expect(service.lockGameVote(session.sessionId)).toMatchObject({
      status: "ready",
      selectedGameId: "dragon-flight",
      tutorialEnabled: true,
      teacherDemoEnabled: false,
    });

    expect(service.startGameIntro(session.sessionId, {
      teacherDemoEnabled: true,
      tutorialEnabled: true,
    })).toMatchObject({ status: "teacher_demo" });
    expect(service.advanceGameIntro(session.sessionId)).toMatchObject({ status: "tutorial" });
    expect(service.advanceGameIntro(session.sessionId, 3000)).toMatchObject({
      status: "countdown",
      selectedGameId: "dragon-flight",
    });
  });

  it("lets the tutor disable tutorial and start the countdown directly", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, SENTENCE_GAME_PHASE);
    service.lockGameVote(session.sessionId);
    expect(service.startGameIntro(session.sessionId, {
      teacherDemoEnabled: false,
      tutorialEnabled: false,
    })).toMatchObject({ status: "countdown", selectedGameId: "castle-defense" });
  });
});
