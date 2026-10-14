import { describe, expect, it } from "vitest";
import {
  getLobbyActivity,
  getLobbyActivityMode,
  shouldShowLiveAssessment,
  sortParticipantsMeFirst,
} from "./lobbyModel";

describe("sortParticipantsMeFirst", () => {
  it("moves the current student to the front without reordering the rest", () => {
    const list = [{ studentId: "a" }, { studentId: "b" }, { studentId: "me" }, { studentId: "c" }];
    expect(sortParticipantsMeFirst(list, "me").map((p) => p.studentId)).toEqual(["me", "a", "b", "c"]);
    expect(list.map((p) => p.studentId)).toEqual(["a", "b", "me", "c"]);
  });
});

describe("shouldShowLiveAssessment", () => {
  const running = { supported: true, mode: "PRE", status: "RUNNING" };
  it("takes over the lobby only for a running pre/post assessment in phase 0", () => {
    expect(shouldShowLiveAssessment(running, 0)).toBe(true);
    expect(shouldShowLiveAssessment({ ...running, mode: "POST" }, 0)).toBe(true);
  });
  it("stays in the lobby otherwise", () => {
    expect(shouldShowLiveAssessment({ ...running, status: "LOBBY" }, 0)).toBe(false);
    expect(shouldShowLiveAssessment({ ...running, mode: "LESSON" }, 0)).toBe(false);
    expect(shouldShowLiveAssessment({ ...running, supported: false }, 0)).toBe(false);
    expect(shouldShowLiveAssessment(running, 1)).toBe(false);
    expect(shouldShowLiveAssessment(running, undefined)).toBe(false);
    expect(shouldShowLiveAssessment(null, 0)).toBe(false);
  });
});

describe("getLobbyActivity", () => {
  it("falls back to the lesson when assessments are not supported", () => {
    expect(getLobbyActivityMode(null)).toBe("LESSON");
    expect(getLobbyActivityMode({ supported: false, mode: "PRE" })).toBe("LESSON");
    expect(getLobbyActivityMode({ supported: true, mode: "POST" })).toBe("POST");
  });

  it("explains the lesson flow", () => {
    expect(getLobbyActivity("LESSON", false).description).toBe(getLobbyActivity("LESSON", true).description);
  });

  it("tells the student what to do before an assessment", () => {
    const notReady = getLobbyActivity("PRE", false);
    const ready = getLobbyActivity("PRE", true);
    expect(notReady.title).toBe("แบบประเมินก่อนเรียน");
    expect(notReady.description).toBe("กดพร้อมก่อน แล้วรอคุณครูเริ่มแบบประเมินก่อนเรียน");
    expect(ready.description).toBe("คุณพร้อมแล้ว รอคุณครูเริ่มแบบประเมินก่อนเรียน");
    expect(getLobbyActivity("POST", true).title).toBe("แบบประเมินหลังเรียน");
  });
});
