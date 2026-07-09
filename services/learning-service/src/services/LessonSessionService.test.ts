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

    service.submitGameVote(session.sessionId, "student-1", "dragon-rider");
    service.submitGameVote(session.sessionId, "student-2", "dragon-rider");
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-rider");
    service.markGamePlaying(session.sessionId);
    const first = service.submitGameResult(session.sessionId, "student-1", {
      gameId: "dragon-rider",
      score: 8,
      correct: 4,
      total: 5,
    });
    const duplicate = service.submitGameResult(session.sessionId, "student-1", {
      gameId: "dragon-rider",
      score: 8,
    });
    expect(first?.accepted).toBe(true);
    expect(duplicate?.accepted).toBe(false);
    expect(session.participants.get("student-1")?.score).toBe(8);

    service.setPhase(session.sessionId, 14);
    expect(session.gameState).toMatchObject({ phase: 14, category: "sentence", status: "voting" });
    expect(session.gameState?.results).toEqual({});
  });

  it("falls back to default games when no one votes", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.setPhase(session.sessionId, 10);
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("rune-match");

    service.setPhase(session.sessionId, 14);
    expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dungeon-liberator");
  });
});
