import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  isStudentSessionParticipant,
  isTutorSessionOwner,
  verifySocketActor,
} from "./lessonHandler";

function session(
  tutorId = "tutor-1",
  tutorSocketId = "socket-tutor",
  studentIds = ["student-1"],
) {
  return {
    tutorId,
    tutorSocketId,
    participants: new Map(studentIds.map((id) => [id, {}])),
  };
}

describe("lesson socket authorization", () => {
  it("derives the actor exclusively from verified JWT claims", () => {
    const secret = "test-secret";
    const token = jwt.sign(
      { userId: "student-from-token", role: "STUDENT" },
      secret,
    );

    expect(verifySocketActor(token, secret)).toEqual({
      userId: "student-from-token",
      role: "STUDENT",
    });
    expect(() => verifySocketActor(token, "wrong-secret")).toThrow();
  });

  it("rejects tokens without the required identity claims", () => {
    const secret = "test-secret";
    const missingRole = jwt.sign({ userId: "student-1" }, secret);
    const stringPayload = jwt.sign("student-1", secret);

    expect(() => verifySocketActor(missingRole, secret)).toThrow(
      "Invalid token claims",
    );
    expect(() => verifySocketActor(stringPayload, secret)).toThrow(
      "Invalid token claims",
    );
  });

  it("allows only the tutor owning the session on the active tutor socket", () => {
    const activeSession = session();

    expect(
      isTutorSessionOwner(
        { userId: "tutor-1", role: "TUTOR" },
        "socket-tutor",
        activeSession,
      ),
    ).toBe(true);
    expect(
      isTutorSessionOwner(
        { userId: "tutor-2", role: "TUTOR" },
        "socket-tutor",
        activeSession,
      ),
    ).toBe(false);
    expect(
      isTutorSessionOwner(
        { userId: "tutor-1", role: "TUTOR" },
        "stale-socket",
        activeSession,
      ),
    ).toBe(false);
    expect(
      isTutorSessionOwner(
        { userId: "tutor-1", role: "STUDENT" },
        "socket-tutor",
        activeSession,
      ),
    ).toBe(false);
  });

  it("allows students to mutate only sessions they have joined", () => {
    const activeSession = session();

    expect(
      isStudentSessionParticipant(
        { userId: "student-1", role: "STUDENT" },
        activeSession,
      ),
    ).toBe(true);
    expect(
      isStudentSessionParticipant(
        { userId: "student-2", role: "STUDENT" },
        activeSession,
      ),
    ).toBe(false);
    expect(
      isStudentSessionParticipant(
        { userId: "student-1", role: "TUTOR" },
        activeSession,
      ),
    ).toBe(false);
  });

  it("denies missing actors and missing sessions", () => {
    expect(isTutorSessionOwner(undefined, "socket-tutor", session())).toBe(false);
    expect(
      isTutorSessionOwner(
        { userId: "tutor-1", role: "TUTOR" },
        "socket-tutor",
        undefined,
      ),
    ).toBe(false);
    expect(isStudentSessionParticipant(undefined, session())).toBe(false);
    expect(
      isStudentSessionParticipant(
        { userId: "student-1", role: "STUDENT" },
        undefined,
      ),
    ).toBe(false);
  });
});
