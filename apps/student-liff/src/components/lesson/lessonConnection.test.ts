import { describe, expect, it } from "vitest";
import { getLessonConnectionState, getLessonErrorKind } from "./lessonConnection";

// Exact text the learning service sends when the tutor has not started a session.
const NO_SESSION = "ยังไม่มีคลาสที่เปิดสอนในขณะนี้ หรือคุณครูยังไม่ได้เริ่มเซสชัน";

describe("getLessonConnectionState", () => {
  it("is ok without an error", () => {
    expect(getLessonConnectionState(null, true)).toBe("ok");
    expect(getLessonConnectionState(undefined, false)).toBe("ok");
    expect(getLessonConnectionState("", false)).toBe("ok");
  });

  it("keeps the lesson on screen while reconnecting after joining", () => {
    expect(getLessonConnectionState("xhr poll error", true)).toBe("reconnecting");
  });

  it("is fatal before the student has joined", () => {
    expect(getLessonConnectionState("Your session is not ready. Please sign in again.", false)).toBe("fatal");
    expect(getLessonConnectionState(NO_SESSION, false)).toBe("fatal");
  });

  it("is fatal when the session is gone, even after joining (reconnecting cannot fix it)", () => {
    expect(getLessonConnectionState(NO_SESSION, true)).toBe("fatal");
  });
});

describe("getLessonErrorKind", () => {
  it("recognises the server's 'no open session' reply", () => {
    expect(getLessonErrorKind(NO_SESSION)).toBe("notStarted");
  });

  it("passes other Thai server messages through", () => {
    expect(getLessonErrorKind("ห้องเรียน Demo นี้หมดอายุแล้ว ไม่สามารถเริ่มสอนได้")).toBe("server");
  });

  it("treats raw English / transport errors as network problems", () => {
    expect(getLessonErrorKind("xhr poll error")).toBe("network");
    expect(getLessonErrorKind("Could not prepare the lesson session.")).toBe("network");
    expect(getLessonErrorKind(null)).toBe("network");
  });
});
