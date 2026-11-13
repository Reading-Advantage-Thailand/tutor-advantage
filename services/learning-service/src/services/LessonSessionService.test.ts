import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPREHENSION_PHASE,
  GUIDED_RESPONSE_PHASE,
  KEY_SENTENCES_PHASE,
  MAX_GAME_SCORE,
  SENTENCE_GAME_PHASE,
  TUTOR_LOBBY_GRACE_MS,
  TUTOR_RECONNECT_GRACE_MS,
  VOCABULARY_GAME_PHASE,
  getTutorGraceMs,
  lessonSessionService as service,
} from "./LessonSessionService";

const CLOCKED = { scoreClock: true };

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

  it("follows a student who reconnected on another instance, so the dropped socket here cannot mark them offline", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    const localSockets = new Set<string>();

    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "socket-b" }],
    }, { isLocalSocket: (id) => localSockets.has(id) });

    expect(session.participants.get("student-1")?.socketId).toBe("socket-b");
    expect(service.markParticipantOffline(session.sessionId, "student-1", "socket-a")).toBeUndefined();
    expect(session.participants.get("student-1")?.offlineSince).toBeUndefined();
  });

  it("takes the newer connection even while a dropped socket here has not timed out", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    const joinedHere = session.participants.get("student-1")!.connectedAt!;
    // socket-a is dead but still listed as connected until the ping timeout.
    const stillListed = (id: string) => id === "socket-a";

    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "socket-b", connectedAt: joinedHere + 3_000 }],
    }, { isLocalSocket: stillListed });
    expect(session.participants.get("student-1")).toMatchObject({ socketId: "socket-b", connectedAt: joinedHere + 3_000 });

    // A late list from an instance that still has the old socket, marked offline there.
    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "socket-a", connectedAt: joinedHere, offlineSince: joinedHere + 50_000 }],
    }, { isLocalSocket: stillListed });
    expect(session.participants.get("student-1")?.socketId).toBe("socket-b");
    expect(session.participants.get("student-1")?.offlineSince).toBeUndefined();
  });

  it("never lets a database placeholder stand in for a real connection", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "restored:student-1");
    expect(session.participants.get("student-1")?.connectedAt).toBeUndefined();

    // A real connection elsewhere replaces the placeholder here.
    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "socket-b" }],
    }, { isLocalSocket: () => false });
    expect(session.participants.get("student-1")?.socketId).toBe("socket-b");

    // Marked offline here; a list from an instance that only knows the student
    // from the database must not clear that.
    service.joinSessionByClassId("class-1", "student-2", "Ben", "socket-c");
    expect(service.markParticipantOffline(session.sessionId, "student-2", "socket-c")).toBeTruthy();
    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-2", name: "Ben", socketId: "restored:student-2" }],
    }, { isLocalSocket: () => true });
    expect(session.participants.get("student-2")).toMatchObject({ socketId: "socket-c" });
    expect(session.participants.get("student-2")?.offlineSince).toEqual(expect.any(Number));
  });

  describe("with several service instances", () => {
    it("keeps each instance's newer points when two students score at once on two instances", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      service.joinSessionByClassId("class-1", "y", "Y", "socket-y");
      // X scores here.
      const x = session.participants.get("x")!;
      x.score = 10;
      x.scoreAt = 5_000;

      // The other instance counted Y and still has X at 0 from before.
      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [
          { studentId: "x", name: "X", socketId: "socket-x", score: 0, scoreAt: 1_000 },
          { studentId: "y", name: "Y", socketId: "socket-y", score: 10, scoreAt: 5_001 },
        ],
      }, CLOCKED);

      expect(session.participants.get("x")).toMatchObject({ score: 10, scoreAt: 5_000 });
      expect(session.participants.get("y")).toMatchObject({ score: 10, scoreAt: 5_001 });
    });

    it("does not let a roster rebuilt from the database replace live points", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      const x = session.participants.get("x")!;
      x.score = 7;
      x.scoreAt = 5_000;

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "restored:x", score: 4 }],
      }, CLOCKED);

      expect(session.participants.get("x")?.score).toBe(7);
    });

    it("keeps a new lesson cycle's reset when an older roster arrives", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      session.participants.get("x")!.score = 9;
      session.participants.get("x")!.scoreAt = Date.now() - 60_000;
      service.setPhase(session.sessionId, 1);
      expect(session.participants.get("x")?.score).toBe(0);

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "socket-x", score: 9, scoreAt: Date.now() - 60_000 }],
      }, CLOCKED);

      expect(session.participants.get("x")?.score).toBe(0);
    });

    it("keeps a kicked student out when another instance only knows them from the database", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      service.kickParticipant(session.sessionId, "x");

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "restored:x", score: 3 }],
      }, CLOCKED);
      // A real socket that connected before the kick is a stale list too.
      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "socket-old", connectedAt: Date.now() - 60_000 }],
      }, CLOCKED);

      expect(session.participants.has("x")).toBe(false);
      expect(session.kickedParticipants?.has("x")).toBe(true);
    });

    it("lets a kicked student back after a real rejoin elsewhere, with the points they had", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      session.participants.get("x")!.score = 6;
      session.participants.get("x")!.scoreAt = Date.now() - 10_000;
      service.kickParticipant(session.sessionId, "x");

      // The other instance has no score history for X, so it reports 0 with no time.
      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "socket-new", connectedAt: Date.now() + 1_000, score: 0 }],
      }, CLOCKED);

      expect(session.kickedParticipants?.has("x")).toBe(false);
      expect(session.participants.get("x")).toMatchObject({ socketId: "socket-new", score: 6 });
    });
  });

  describe("review fixes for several instances", () => {
    it("takes the sender's scores, as before, from a revision without score times", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      session.participants.get("x")!.score = 3;
      session.participants.get("x")!.scoreAt = Date.now();

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "socket-x", score: 5 }],
      });

      expect(session.participants.get("x")).toMatchObject({ score: 5, scoreAt: undefined });
    });

    it("keeps its own value when another instance reports the same score time", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      session.participants.get("x")!.score = 8;
      session.participants.get("x")!.scoreAt = 5_000;

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "x", name: "X", socketId: "socket-x", score: 2, scoreAt: 5_000 }],
      }, CLOCKED);

      expect(session.participants.get("x")?.score).toBe(8);
    });

    it("gives a score read from the database no change time", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      session.participants.get("x")!.scoreAt = 5_000;

      service.mergePersistedParticipant(session.sessionId, "x", "X", undefined, 12);

      expect(session.participants.get("x")).toMatchObject({ score: 12, scoreAt: undefined });
    });

    it("rebuilds a removed student as a kick record that resumes their points on rejoin", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.restoreRemovedParticipant(session.sessionId, "x", "X", undefined, 15, 1_000);

      expect(session.participants.has("x")).toBe(false);
      service.joinSessionByClassId("class-1", "x", "X", "socket-x2");
      expect(session.participants.get("x")).toMatchObject({ score: 15, socketId: "socket-x2", hasAnsweredCurrentPhase: false });
    });

    it("starts a removed student at 0 in a new lesson cycle", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      service.setPhase(session.sessionId, 18);
      session.participants.get("x")!.score = 15;
      service.kickParticipant(session.sessionId, "x");

      service.setPhase(session.sessionId, 1);
      service.joinSessionByClassId("class-1", "x", "X", "socket-x2");

      expect(session.participants.get("x")?.score).toBe(0);
    });

    it("keeps points counted elsewhere during a failed phase change, and undoes its own reset", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      service.joinSessionByClassId("class-1", "y", "Y", "socket-y");
      service.setPhase(session.sessionId, 18);
      session.participants.get("x")!.score = 9;
      session.participants.get("x")!.scoreAt = 1_000;
      session.participants.get("y")!.score = 4;
      session.participants.get("y")!.scoreAt = 1_000;
      const before = service.captureTransitionState(session.sessionId)!;

      // A new cycle resets everyone, then Y scores on another instance while it saves.
      service.setPhase(session.sessionId, 1);
      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "y", name: "Y", socketId: "socket-y", score: 14, scoreAt: Date.now() + 5, hasAnsweredCurrentPhase: true }],
      }, CLOCKED);

      service.restoreTransitionState(session.sessionId, before);

      expect(session.currentPhase).toBe(18);
      expect(session.participants.get("x")?.score).toBe(9);
      expect(session.participants.get("x")!.scoreAt!).toBeGreaterThan(1_000);
      expect(session.participants.get("y")).toMatchObject({ score: 14, hasAnsweredCurrentPhase: true });
    });
  });

  describe("rolling back a failed transition", () => {
    it("does not mark a rewound phase's answers as answers to the phase the class returns to", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "a", "A", "socket-a");
      service.setPhase(session.sessionId, 7);
      session.participants.get("a")!.hasAnsweredCurrentPhase = true;
      session.participants.get("a")!.latestAnswer = "phase 7 answer";
      service.setPhase(session.sessionId, 9);
      expect(session.participants.get("a")?.hasAnsweredCurrentPhase).toBe(false);
      const before = service.captureTransitionState(session.sessionId)!;

      service.rewindPhase(session.sessionId, 7);
      expect(session.participants.get("a")?.hasAnsweredCurrentPhase).toBe(true);
      service.restoreTransitionState(session.sessionId, before);

      expect(session.currentPhase).toBe(9);
      expect(session.participants.get("a")).toMatchObject({ hasAnsweredCurrentPhase: false, latestAnswer: undefined });
    });

    it("gives back the points of a student removed while a failed cycle reset was saving", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "x", "X", "socket-x");
      service.joinSessionByClassId("class-1", "k", "K", "socket-k");
      service.setPhase(session.sessionId, 18);
      session.participants.get("x")!.score = 9;
      session.participants.get("k")!.score = 5;
      service.kickParticipant(session.sessionId, "k");
      const before = service.captureTransitionState(session.sessionId)!;

      service.setPhase(session.sessionId, 1);
      // While it saves: X is removed, K comes back.
      service.kickParticipant(session.sessionId, "x");
      service.joinSessionByClassId("class-1", "k", "K", "socket-k2");
      service.restoreTransitionState(session.sessionId, before);

      expect(session.kickedParticipants?.get("x")?.participant.score).toBe(9);
      expect(session.participants.get("k")).toMatchObject({ score: 5, socketId: "socket-k2" });
    });
  });

  describe("answer flags from other instances", () => {
    it("ignores answer flags in a roster sent for the phase the class just left", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "s", "S", "socket-s");
      service.setPhase(session.sessionId, 4);
      const oldVersion = session.phaseVersion;
      service.setPhase(session.sessionId, 5);

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        phaseVersion: oldVersion,
        participants: [{ studentId: "s", name: "S", socketId: "socket-s", hasAnsweredCurrentPhase: true, latestAnswer: "A" }],
      }, CLOCKED);

      expect(session.participants.get("s")).toMatchObject({ hasAnsweredCurrentPhase: false, latestAnswer: undefined });
    });

    it("does not reopen an answer saved here when another instance's roster has not caught up", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "s", "S", "socket-s");
      service.setPhase(session.sessionId, 4);
      session.participants.get("s")!.hasAnsweredCurrentPhase = true;
      session.participants.get("s")!.latestAnswer = "C";

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        phaseVersion: session.phaseVersion,
        participants: [{ studentId: "s", name: "S", socketId: "socket-s", hasAnsweredCurrentPhase: false }],
      }, CLOCKED);

      expect(session.participants.get("s")).toMatchObject({ hasAnsweredCurrentPhase: true, latestAnswer: "C" });
    });

    it("still lets a reserved answer be released, and takes an answer saved elsewhere", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "r", "R", "socket-r");
      service.joinSessionByClassId("class-1", "t", "T", "socket-t");
      service.setPhase(session.sessionId, 8);
      session.participants.get("r")!.hasAnsweredCurrentPhase = true; // reserved, AI still grading elsewhere

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        phaseVersion: session.phaseVersion,
        participants: [
          { studentId: "r", name: "R", socketId: "socket-r", hasAnsweredCurrentPhase: false },
          { studentId: "t", name: "T", socketId: "socket-t", hasAnsweredCurrentPhase: true, latestAnswer: "essay" },
        ],
      }, CLOCKED);

      expect(session.participants.get("r")?.hasAnsweredCurrentPhase).toBe(false);
      expect(session.participants.get("t")).toMatchObject({ hasAnsweredCurrentPhase: true, latestAnswer: "essay" });
    });
  });

  describe("last review", () => {
    it("does not bring back an earlier phase's answer when a removed student rejoins elsewhere", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "s", "S", "socket-s");
      service.setPhase(session.sessionId, 7);
      session.participants.get("s")!.hasAnsweredCurrentPhase = true;
      session.participants.get("s")!.latestAnswer = "phase 7";
      service.kickParticipant(session.sessionId, "s");
      service.setPhase(session.sessionId, 8);

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        phaseVersion: session.phaseVersion,
        participants: [{ studentId: "s", name: "S", socketId: "socket-s2", connectedAt: Date.now() + 1_000, hasAnsweredCurrentPhase: false }],
      }, CLOCKED);

      expect(session.participants.get("s")).toMatchObject({ hasAnsweredCurrentPhase: false, latestAnswer: undefined });
    });

    it("keeps a reservation for a student connected here when another instance's roster lags", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "s", "S", "socket-s");
      service.setPhase(session.sessionId, 8);
      expect(service.reserveAnswer(session.sessionId, "s")?.accepted).toBe(true);

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        phaseVersion: session.phaseVersion,
        participants: [{ studentId: "s", name: "S", socketId: "socket-s", hasAnsweredCurrentPhase: false }],
      }, { ...CLOCKED, isLocalSocket: (id) => id === "socket-s" });

      expect(session.participants.get("s")?.hasAnsweredCurrentPhase).toBe(true);
      expect(service.reserveAnswer(session.sessionId, "s")?.accepted).toBe(false);
    });

    it("keeps an answer given on another instance while a failed rewind was saving, not the rewound one", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "s", "S", "socket-s");
      service.setPhase(session.sessionId, 11);
      session.participants.get("s")!.hasAnsweredCurrentPhase = true;
      session.participants.get("s")!.latestAnswer = "phase 11 answer";
      service.setPhase(session.sessionId, 12);
      const before = service.captureTransitionState(session.sessionId)!;
      const versionBefore = session.phaseVersion;

      service.rewindPhase(session.sessionId, 11);
      // The other instance is still on phase 12 and S answers it there.
      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        phaseVersion: versionBefore,
        participants: [{ studentId: "s", name: "S", socketId: "socket-s", score: 1, scoreAt: Date.now() + 5, hasAnsweredCurrentPhase: true, latestAnswer: "phase 12 answer" }],
      }, CLOCKED);
      service.restoreTransitionState(session.sessionId, before);

      expect(session.currentPhase).toBe(12);
      expect(session.participants.get("s")).toMatchObject({ hasAnsweredCurrentPhase: true, latestAnswer: "phase 12 answer", score: 1 });
    });
  });

  it("keeps the answer a removed student gave before being removed when they come back", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.setPhase(session.sessionId, 4);
    service.restoreRemovedParticipant(session.sessionId, "x", "X", undefined, 3, 1_000);
    service.markRemovedParticipantAnswered(session.sessionId, "x", "B");

    service.joinSessionByClassId("class-1", "x", "X", "socket-x");

    expect(session.participants.get("x")).toMatchObject({ hasAnsweredCurrentPhase: true, latestAnswer: "B", score: 3 });
  });

  it("keeps scores on other instances when the tutor goes back to phase 1", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "l", "L", "socket-l");
    service.setPhase(session.sessionId, 9);
    session.participants.get("l")!.score = 4;

    service.applyRemoteEvent(session.sessionId, "phase_changed", {
      phase: 1, phaseVersion: session.phaseVersion + 1, phaseChangeId: "rewind-to-1", phaseRestored: true,
    });
    expect(session.participants.get("l")?.score).toBe(4);

    service.applyRemoteEvent(session.sessionId, "phase_changed", {
      phase: 1, phaseVersion: session.phaseVersion + 1, phaseChangeId: "new-cycle", phaseRestored: false,
    });
    expect(session.participants.get("l")?.score).toBe(0);
  });

  it("keeps live joins and reconnects when a failed phase change is rolled back", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "x", "X", "socket-x");
    service.setPhase(session.sessionId, 3);
    session.participants.get("x")!.score = 2;
    const before = service.captureTransitionState(session.sessionId)!;

    service.setPhase(session.sessionId, 4);
    // While the phase change was saving: X reconnected, Z joined and answered on
    // another instance, which was still on phase 3.
    service.joinSessionByClassId("class-1", "x", "X", "socket-x2");
    service.joinSessionByClassId("class-1", "z", "Z", "socket-z");
    session.participants.get("z")!.hasAnsweredCurrentPhase = true;
    session.participants.get("z")!.latestAnswer = "B";

    service.restoreTransitionState(session.sessionId, before);

    expect(session.currentPhase).toBe(3);
    expect(session.participants.get("x")).toMatchObject({ socketId: "socket-x2", score: 2 });
    // A forward move cleared every answer, so Z's answer is for phase 3 and stays.
    expect(session.participants.get("z")).toMatchObject({ socketId: "socket-z", hasAnsweredCurrentPhase: true, latestAnswer: "B" });
    expect(service.markParticipantOffline(session.sessionId, "x", "socket-x")).toBeUndefined();
  });

  it("keeps a student's socket that is connected to this instance", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    const localSockets = new Set(["socket-a"]);

    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "socket-old" }],
    }, { isLocalSocket: (id) => localSockets.has(id) });
    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "restored:student-1" }],
    }, { isLocalSocket: () => false });

    expect(session.participants.get("student-1")?.socketId).toBe("socket-a");
  });

  it("does not let a lagging instance reopen a game the tutor ended, or drop its results", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    const round = { phase: VOCABULARY_GAME_PHASE, category: "vocabulary", selectedGameId: "dragon-flight", votes: {}, voteFirstSeen: {}, playingStartedAt: 1_000 };
    const resultOf = (studentId: string, score: number) => ({ studentId, name: studentId, gameId: "dragon-flight", score, submittedAt: 2_000 });
    session.currentPhase = VOCABULARY_GAME_PHASE;
    session.gameState = { ...round, status: "results", results: { a: resultOf("a", 4) } } as never;

    service.applyRemoteEvent(session.sessionId, "game_results_updated", {
      gameState: { ...round, status: "playing", results: { b: resultOf("b", 6) } },
    });
    expect(session.gameState?.status).toBe("results");
    expect(Object.keys(session.gameState?.results ?? {}).sort()).toEqual(["a", "b"]);

    // Two last results that landed on two instances at once close the round once merged.
    service.joinSessionByClassId("class-1", "a", "A", "socket-a");
    service.joinSessionByClassId("class-1", "b", "B", "socket-b");
    session.gameState = { ...round, status: "playing", results: { a: resultOf("a", 4) }, expectedStudentIds: ["a", "b"] } as never;
    service.applyRemoteEvent(session.sessionId, "game_results_updated", {
      gameState: { ...round, status: "playing", results: { b: resultOf("b", 6) }, expectedStudentIds: ["a", "b"] },
    });
    expect(session.gameState?.status).toBe("results");

    // A result from a phase the room has left is stale and changes nothing.
    const before = session.gameState;
    service.applyRemoteEvent(session.sessionId, "game_results_updated", {
      gameState: { ...round, phase: VOCABULARY_GAME_PHASE - 1, status: "playing", results: {} },
    });
    expect(session.gameState).toBe(before);

    // A new round of play replaces the old one.
    service.applyRemoteEvent(session.sessionId, "game_state_changed", {
      gameState: { ...round, playingStartedAt: 9_000, status: "playing", results: {} },
    });
    expect(session.gameState?.status).toBe("playing");
    expect(session.gameState?.results).toEqual({});
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

  it("caps oversized game counts instead of dropping the result", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    service.lockGameVote(session.sessionId);
    service.markGamePlaying(session.sessionId);
    const gameId = session.gameState?.selectedGameId ?? undefined;

    expect(service.submitGameResult(session.sessionId, "student-1", { gameId, score: 4, correct: 4, total: -1 })).toBeNull();
    expect(service.submitGameResult(session.sessionId, "student-1", { gameId, score: 4, correct: 1.5, total: 10 })).toBeNull();
    expect(service.submitGameResult(session.sessionId, "student-1", { gameId, score: 4, correct: 9, total: 5 })).toBeNull();

    const submitted = service.submitGameResult(session.sessionId, "student-1", { gameId, score: 4, correct: 4, total: 240 });
    expect(submitted?.accepted).toBe(true);
    expect(submitted?.gameState.results["student-1"]).toMatchObject({ score: 4, correct: 4, total: 100 });
  });

  it("finishes a game when the tutor kicks the last student still playing", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.joinSessionByClassId("class-1", "student-2", "Bob", "socket-b");
    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    service.lockGameVote(session.sessionId);
    service.markGamePlaying(session.sessionId);
    service.submitGameResult(session.sessionId, "student-1", { gameId: "dragon-flight", score: 8 });

    const kicked = service.kickParticipant(session.sessionId, "student-2");

    expect(kicked).toMatchObject({ gameCompleted: true, allAnswered: false });
    expect(session.gameState?.status).toBe("results");
    expect(session.participants.has("student-2")).toBe(false);
    expect(service.kickParticipant(session.sessionId, "student-2")).toBeUndefined();
  });

  it("does not let a kicked student's result stand in for someone still playing", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    for (const [id, socketId] of [["student-1", "socket-a"], ["student-2", "socket-b"], ["student-3", "socket-c"]]) {
      service.joinSessionByClassId("class-1", id, id, socketId);
    }
    service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
    service.lockGameVote(session.sessionId);
    service.markGamePlaying(session.sessionId);
    service.submitGameResult(session.sessionId, "student-1", { gameId: "dragon-flight", score: 8 });

    expect(service.kickParticipant(session.sessionId, "student-1")?.gameCompleted).toBe(false);
    const second = service.submitGameResult(session.sessionId, "student-2", { gameId: "dragon-flight", score: 5 });

    expect(second?.allSubmitted).toBe(false);
    expect(session.gameState?.status).toBe("playing");
  });

  it("reports all answered when the kicked student was the only one left to answer", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    service.joinSessionByClassId("class-1", "student-2", "Bob", "socket-b");
    service.setPhase(session.sessionId, COMPREHENSION_PHASE);
    service.reserveAnswer(session.sessionId, "student-1");
    service.completeReservedAnswer(session.sessionId, "student-1", "A");

    expect(service.kickParticipant(session.sessionId, "student-2")).toMatchObject({
      allAnswered: true,
      gameCompleted: false,
    });
  });

  it("keeps a kicked student out of restores until they rejoin with their score", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
    session.participants.get("student-1")!.score = 12;
    service.kickParticipant(session.sessionId, "student-1");

    // Another student's reconnect merges DB participants; the kicked one stays out.
    service.mergePersistedParticipant(session.sessionId, "student-1", "Ada", undefined, 12);
    expect(session.participants.has("student-1")).toBe(false);
    // A stale list from another instance (same old socket) does not re-add them.
    service.applyRemoteEvent(session.sessionId, "participants_updated", {
      participants: [{ studentId: "student-1", name: "Ada", socketId: "socket-a" }],
    });
    expect(session.participants.has("student-1")).toBe(false);

    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-new");
    expect(session.participants.get("student-1")).toMatchObject({ socketId: "socket-new", score: 12 });
  });

  it("applies a kick received from another instance", () => {
    const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
    service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

    service.applyRemoteEvent(session.sessionId, "kicked", { studentId: "student-1" });

    expect(session.participants.has("student-1")).toBe(false);
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

  describe("tutor connection", () => {
    it("waits minutes for a tutor mid-lesson but not for one in the lobby", () => {
      expect(getTutorGraceMs({ currentPhase: 10, isDemo: false })).toBe(TUTOR_RECONNECT_GRACE_MS);
      expect(TUTOR_RECONNECT_GRACE_MS).toBeGreaterThanOrEqual(5 * 60_000);
      expect(getTutorGraceMs({ currentPhase: 0, isDemo: false })).toBe(TUTOR_LOBBY_GRACE_MS);
      expect(getTutorGraceMs({ currentPhase: 10, isDemo: true })).toBe(TUTOR_LOBBY_GRACE_MS);
    });

    it("keeps the room, phase and game running while the tutor is away, and hands them back", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
      service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
      service.lockGameVote(session.sessionId);
      service.markGamePlaying(session.sessionId);

      expect(service.markTutorAway(session.sessionId, 1_000)).toBe(true);
      expect(service.markTutorAway(session.sessionId, 2_000)).toBe(false);
      expect(session.tutorAwaySince).toBe(1_000);
      expect(service.submitGameResult(session.sessionId, "student-1", { score: 3, correct: 3, total: 10 })?.accepted).toBe(true);

      const back = service.createSession("tutor-1", "socket-2", "article-1", {}, "class-1");
      expect(back).toBe(session);
      expect(back.currentPhase).toBe(VOCABULARY_GAME_PHASE);
      expect(back.gameState?.results["student-1"]?.score).toBe(3);
      expect(service.clearTutorAway(session.sessionId)).toBe(true);
      expect(service.clearTutorAway(session.sessionId)).toBe(false);
    });

    it("does not treat a student reconnecting as the tutor returning", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
      service.markTutorAway(session.sessionId);

      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

      expect(session.tutorSocketId).toBe("socket-1");
      expect(session.tutorAwaySince).toBeTruthy();
    });

    it("mirrors the tutor's state from another instance", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

      service.applyRemoteEvent(session.sessionId, "tutor_away", { since: 5_000 });
      expect(session.tutorAwaySince).toBe(5_000);
      service.applyRemoteEvent(session.sessionId, "tutor_back", {});
      expect(session.tutorAwaySince).toBeUndefined();
    });
  });

  describe("ending a game", () => {
    const startGame = (studentIds: string[]) => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      for (const id of studentIds) service.joinSessionByClassId("class-1", id, id, `socket-${id}`);
      service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
      service.lockGameVote(session.sessionId);
      service.markGamePlaying(session.sessionId);
      return session;
    };

    it("lets the tutor end a game with nothing submitted", () => {
      const session = startGame(["student-1", "student-2"]);

      const ended = service.endGame(session.sessionId);

      expect(ended?.gameState.status).toBe("results");
      expect(ended?.gameState.results).toEqual({});
    });

    it("only ends a running game", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
      expect(service.endGame(session.sessionId)).toBeNull();
      service.lockGameVote(session.sessionId);
      service.startGameCountdown(session.sessionId);
      expect(service.endGame(session.sessionId)).toBeNull();
    });

    it("keeps a late result, and it does not reopen the game", () => {
      const session = startGame(["student-1", "student-2", "student-3"]);
      service.submitGameResult(session.sessionId, "student-1", { score: 5 });
      service.endGame(session.sessionId);

      const late = service.submitGameResult(session.sessionId, "student-2", { score: 4 });

      expect(late?.accepted).toBe(true);
      expect(late?.allSubmitted).toBe(false);
      expect(session.gameState?.status).toBe("results");
      expect(session.participants.get("student-2")?.score).toBe(4);
    });

    it("does not wait for a student who joined after play began", () => {
      const session = startGame(["student-1", "student-2"]);
      service.joinSessionByClassId("class-1", "late", "Late", "socket-late");
      expect(session.gameState?.expectedStudentIds).toEqual(["student-1", "student-2"]);

      service.submitGameResult(session.sessionId, "student-1", { score: 1 });
      const second = service.submitGameResult(session.sessionId, "student-2", { score: 2 });

      expect(second?.allSubmitted).toBe(true);
      expect(session.gameState?.status).toBe("results");
      // The late joiner can still play and submit.
      expect(service.submitGameResult(session.sessionId, "late", { score: 3 })?.accepted).toBe(true);
      expect(session.participants.get("late")?.score).toBe(3);
    });

    it("still counts a late joiner who plays before the others finish, without waiting for them", () => {
      const session = startGame(["student-1"]);
      service.joinSessionByClassId("class-1", "late", "Late", "socket-late");

      const late = service.submitGameResult(session.sessionId, "late", { score: 3 });

      expect(late?.allSubmitted).toBe(false);
      expect(session.gameState?.status).toBe("playing");
    });

    it("does not wait again for a kicked student who rejoins mid-game", () => {
      const session = startGame(["student-1", "student-2"]);
      service.kickParticipant(session.sessionId, "student-2");
      service.joinSessionByClassId("class-1", "student-2", "student-2", "socket-new");

      const first = service.submitGameResult(session.sessionId, "student-1", { score: 1 });

      expect(first?.allSubmitted).toBe(true);
      expect(session.gameState?.status).toBe("results");
    });

    it("records when play began, for phones that join a running round", () => {
      const session = startGame(["student-1"]);
      const payload = service.getGameStatePayload(session);

      expect(payload?.playingStartedAt).toBeTypeOf("number");
      expect(payload?.serverNow).toBeGreaterThanOrEqual(payload?.playingStartedAt ?? 0);
    });

    it("shows a game left mid-round as ended when the tutor goes back to it", () => {
      const session = startGame(["student-1"]);
      service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE + 1);

      service.rewindPhase(session.sessionId, VOCABULARY_GAME_PHASE);

      expect(session.phaseRestored).toBe(true);
      expect(session.gameState?.status).toBe("results");
    });

    it("caps an impossible score instead of rejecting the result", () => {
      const session = startGame(["student-1", "student-2"]);

      const forged = service.submitGameResult(session.sessionId, "student-1", { score: 100_000, correct: 1, total: 10 });
      expect(forged?.accepted).toBe(true);
      expect(forged?.gameState.results["student-1"]?.score).toBe(MAX_GAME_SCORE);
      expect(session.participants.get("student-1")?.score).toBe(MAX_GAME_SCORE);

      const huge = service.submitGameResult(session.sessionId, "student-2", { score: 5_000_000 });
      expect(huge?.gameState.results["student-2"]?.score).toBe(MAX_GAME_SCORE);
    });

    it("leaves a score that could be real alone, and still rejects garbage", () => {
      const session = startGame(["student-1", "student-2"]);
      expect(service.submitGameResult(session.sessionId, "student-1", { score: 11, correct: 5, total: 10 })?.gameState.results["student-1"]?.score).toBe(11);
      expect(service.submitGameResult(session.sessionId, "student-2", { score: -1 })).toBeNull();
      expect(service.submitGameResult(session.sessionId, "student-2", { score: 1.5 })).toBeNull();
    });
  });

  describe("reconnecting students", () => {
    it("keeps the live score when the database is behind", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
      session.participants.get("student-1")!.score = 3;

      service.mergePersistedParticipant(session.sessionId, "student-1", "Ada", undefined, 8, { keepLiveScore: true });
      expect(session.participants.get("student-1")?.score).toBe(3);

      // After a missed phase memory is stale, so the database wins.
      service.mergePersistedParticipant(session.sessionId, "student-1", "Ada", undefined, 8);
      expect(session.participants.get("student-1")?.score).toBe(8);
    });

    it("restores the saved score of a student rebuilt from the database", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");

      service.mergePersistedParticipant(session.sessionId, "student-1", "Ada", undefined, 7);

      expect(session.participants.get("student-1")).toMatchObject({ score: 7, socketId: "restored:student-1" });
    });

    it("marks a student offline only if they did not come back on a new socket", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");
      expect(service.findParticipantBySocketId("socket-a")).toEqual({ sessionId: session.sessionId, studentId: "student-1" });

      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-b");
      expect(service.markParticipantOffline(session.sessionId, "student-1", "socket-a")).toBeUndefined();
      expect(session.participants.get("student-1")?.offlineSince).toBeUndefined();

      expect(service.markParticipantOffline(session.sessionId, "student-1", "socket-b")).toBe(session);
      expect(session.participants.get("student-1")?.offlineSince).toBeTypeOf("number");
      // Only the first report changes the roster.
      expect(service.markParticipantOffline(session.sessionId, "student-1", "socket-b")).toBeUndefined();

      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-c");
      expect(session.participants.get("student-1")?.offlineSince).toBeUndefined();
      expect(session.participants.get("student-1")?.score).toBe(0);
    });

    it("carries offline state across instances", () => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      service.joinSessionByClassId("class-1", "student-1", "Ada", "socket-a");

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "student-1", name: "Ada", offlineSince: 123 }],
      });
      expect(session.participants.get("student-1")?.offlineSince).toBe(123);

      service.applyRemoteEvent(session.sessionId, "participants_updated", {
        participants: [{ studentId: "student-1", name: "Ada" }],
      });
      expect(session.participants.get("student-1")?.offlineSince).toBeUndefined();
    });
  });

  describe("votes", () => {
    const openVote = (studentIds: string[]) => {
      const session = service.createSession("tutor-1", "socket-1", "article-1", {}, "class-1");
      for (const id of studentIds) service.joinSessionByClassId("class-1", id, id, `socket-${id}`);
      service.setPhase(session.sessionId, VOCABULARY_GAME_PHASE);
      return session;
    };

    it("sends the same winner the vote will pick when a tie goes to the first vote", () => {
      vi.useFakeTimers();
      try {
        const session = openVote(["a", "b"]);
        vi.setSystemTime(1_000);
        service.submitGameVote(session.sessionId, "a", "rune-match");
        vi.setSystemTime(2_000);
        const state = service.submitGameVote(session.sessionId, "b", "dragon-flight");

        expect(state?.leadingGameId).toBe("rune-match");
        expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("rune-match");
      } finally {
        vi.useRealTimers();
      }
    });

    it("gives the tie to whichever game was voted for first, in either order", () => {
      vi.useFakeTimers();
      try {
        const session = openVote(["a", "b"]);
        vi.setSystemTime(1_000);
        service.submitGameVote(session.sessionId, "a", "dragon-flight");
        vi.setSystemTime(2_000);
        const state = service.submitGameVote(session.sessionId, "b", "rune-match");

        expect(state?.leadingGameId).toBe("dragon-flight");
        expect(service.lockGameVote(session.sessionId)?.selectedGameId).toBe("dragon-flight");
      } finally {
        vi.useRealTimers();
      }
    });

    it("names the default game before anyone votes", () => {
      const session = openVote(["a"]);
      expect(service.getGameStatePayload(session)?.leadingGameId).toBe("dragon-flight");
    });

    it("lets a game lose its first-vote priority once nobody votes for it", () => {
      vi.useFakeTimers();
      try {
        const session = openVote(["a", "b", "c"]);
        vi.setSystemTime(1_000);
        service.submitGameVote(session.sessionId, "a", "rune-match");
        vi.setSystemTime(2_000);
        service.submitGameVote(session.sessionId, "b", "dragon-flight");
        vi.setSystemTime(3_000);
        service.submitGameVote(session.sessionId, "a", "wizard-vs-zombie");
        expect(session.gameState?.voteFirstSeen["rune-match"]).toBeUndefined();
        vi.setSystemTime(4_000);
        const state = service.submitGameVote(session.sessionId, "c", "rune-match");

        // All three have one vote; rune-match's first vote now dates from 4 s.
        expect(state?.leadingGameId).toBe("dragon-flight");
      } finally {
        vi.useRealTimers();
      }
    });

    it("drops a kicked student's vote so it cannot decide the game", () => {
      vi.useFakeTimers();
      try {
        const session = openVote(["a", "b", "c"]);
        vi.setSystemTime(1_000);
        service.submitGameVote(session.sessionId, "a", "dragon-flight");
        vi.setSystemTime(2_000);
        service.submitGameVote(session.sessionId, "b", "rune-match");
        vi.setSystemTime(3_000);
        service.submitGameVote(session.sessionId, "c", "rune-match");

        const kicked = service.kickParticipant(session.sessionId, "c");

        expect(kicked?.votesChanged).toBe(true);
        expect(session.gameState?.votes).toEqual({ a: "dragon-flight", b: "rune-match" });
        expect(service.getGameStatePayload(session)?.leadingGameId).toBe("dragon-flight");
        expect(service.kickParticipant(session.sessionId, "b")?.votesChanged).toBe(true);
        expect(session.gameState?.voteFirstSeen["rune-match"]).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps the result of a closed vote when a voter is kicked", () => {
      const session = openVote(["a", "b"]);
      service.submitGameVote(session.sessionId, "a", "rune-match");
      service.lockGameVote(session.sessionId);

      const kicked = service.kickParticipant(session.sessionId, "a");

      expect(kicked?.votesChanged).toBe(false);
      expect(session.gameState?.selectedGameId).toBe("rune-match");
    });
  });
});
