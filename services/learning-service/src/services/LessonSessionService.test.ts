import { beforeEach, describe, expect, it, vi } from "vitest";

describe("lessonSessionService", () => {
  let service: typeof import("./LessonSessionService").lessonSessionService;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    service = (await import("./LessonSessionService")).lessonSessionService;
  });

  it("creates sessions, indexes them by pin and class, and reuses active class sessions", () => {
    const articleData = {
      multipleChoiceQuestions: [{ question: "Q1" }],
      shortAnswerQuestions: [{ question: "S1" }],
      words: ["apple"],
      sentences: ["A long enough sentence here"],
    };

    const first = service.createSession("tutor-1", "socket-1", "article-1", articleData, "class-1");
    const recovered = service.createSession("tutor-1", "socket-2", "article-1", articleData, "class-1");

    expect(first.pin).toMatch(/^\d{6}$/);
    expect(service.getSessionByPin(first.pin)).toBe(first);
    expect(service.getSessionByClassId("class-1")).toBe(first);
    expect(recovered).toBe(first);
    expect(recovered.tutorSocketId).toBe("socket-2");
  });

  it("keeps participant score and readiness when a student reconnects", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

    service.joinSession(session.pin, "student-1", "Ada", "socket-a");
    service.toggleReady(session.sessionId, "student-1");
    session.participants.get("student-1")!.score = 10;
    service.joinSession(session.pin, "student-1", "Ada", "socket-b", "avatar.png");

    expect(session.participants.get("student-1")).toMatchObject({
      socketId: "socket-b",
      score: 10,
      isReady: true,
      pictureUrl: "avatar.png",
    });
  });

  it("resets answer state on phase changes and reports when all participants answered", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSession(session.pin, "student-1", "Ada", "socket-a");
    service.joinSession(session.pin, "student-2", "Bob", "socket-b");

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
    service.joinSession(session.pin, "student-1", "Ada", "socket-a");

    expect(service.removeParticipantBySocketId("socket-a")).toEqual({
      sessionId: session.sessionId,
      studentId: "student-1",
    });
    expect(service.deleteSession(session.sessionId)).toBe(true);
    expect(service.getSession(session.sessionId)).toBeUndefined();
    expect(service.getSessionByPin(session.pin)).toBeUndefined();
    expect(service.getSessionByClassId("class-1")).toBeUndefined();
  });
});
