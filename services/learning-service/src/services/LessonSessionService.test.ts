import { beforeEach, describe, expect, it, vi } from "vitest";
import { lessonSessionService as service } from "./LessonSessionService";

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
    expect(second?.allAnswered).toBe(true);
    expect(session.participants.get("student-1")?.latestAnswer).toBe("yes");

    service.setPhase(session.sessionId, 2);
    expect(session.participants.get("student-1")).toMatchObject({
      hasAnsweredCurrentPhase: false,
      latestAnswer: undefined,
    });
    expect(session.status).toBe("ACTIVE");
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

    service.setPhase(session.sessionId, 10);
    service.setPhase(session.sessionId, 11);
    expect(service.rewindPhase(session.sessionId, 10)).toBe(session);

    expect(service.toggleReady(session.sessionId, "student-1")).toBeUndefined();
    expect(service.submitAnswer(session.sessionId, "student-1", "answer")).toBeUndefined();
    expect(service.toggleSentenceFlag(session.sessionId, "student-1", 0)).toBeUndefined();
    expect(service.startGameVote(session.sessionId, 10)).toBeNull();
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

    service.setPhase(session.sessionId, 10);
    expect(session.gameState).toMatchObject({ phase: 10, category: "vocabulary", status: "voting" });

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

    service.setPhase(session.sessionId, 14);
    expect(session.gameState).toMatchObject({ phase: 14, category: "sentence", status: "voting" });
    expect(session.gameState?.results).toEqual({});
  });

  it("falls back to default games when no one votes", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, 10);
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-flight");

    service.setPhase(session.sessionId, 14);
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("castle-defense");
  });

  it("ignores votes for locked games", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    service.setPhase(session.sessionId, 10);
    expect(service.submitGameVote(session.sessionId, "student-1", "alchemists-synthesis")).toBeNull();
    expect(session.gameState?.votes).toEqual({});
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-flight");
  });

  it("supports an optional teacher demo and tutorial before the countdown", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, 10);
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

    service.setPhase(session.sessionId, 14);
    service.lockGameVote(session.sessionId);
    expect(service.startGameIntro(session.sessionId, {
      teacherDemoEnabled: false,
      tutorialEnabled: false,
    })).toMatchObject({ status: "countdown", selectedGameId: "castle-defense" });
  });
});
