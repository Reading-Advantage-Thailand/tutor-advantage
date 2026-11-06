import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  attendanceErrorMessage,
  attendanceMeetingHref,
  BACK_GUARD_START,
  backGuardStep,
  buildSaveBody,
  classStudentsHref,
  countsLabel,
  effectiveStatus,
  guardedLinkTarget,
  hasMeetingChips,
  hasUnmarkedStudents,
  isMeetingDate,
  isMeetingTime,
  latestUnmarkedMeeting,
  loadFailureKind,
  markAllPresent,
  meetingBlockReason,
  meetingDateLabel,
  meetingProgress,
  meetingTimeLabel,
  parseMeetingParams,
  pruneChanges,
  statusLabel,
  statusTone,
  summarizeRoster,
  toBangkokDateKey,
  toggleMark,
  validateAdhocMeeting,
  type BackGuardEffect,
  type BackGuardEvent,
  type BackGuardState,
  type MeetingDetail,
  type MeetingSummary,
  type RosterRow,
} from "./attendanceModel";

function row(id: string, overrides: Partial<RosterRow> = {}): RosterRow {
  return { studentUserId: id, name: id, avatarUrl: null, status: null, joinedAt: null, enrolled: true, joinedLater: false, ...overrides };
}

function summary(overrides: Partial<MeetingSummary> = {}): MeetingSummary {
  return {
    date: "2026-11-05",
    start: "19:00",
    end: "21:00",
    source: "SCHEDULED",
    inSchedule: true,
    movedFrom: null,
    counts: { present: 0, late: 0, absent: 0, unmarked: 3 },
    marked: false,
    ...overrides,
  };
}

const detail: MeetingDetail = {
  date: "2026-11-05",
  start: "19:00",
  end: "21:00",
  source: "SCHEDULED",
  inSchedule: true,
  movedFrom: null,
  markable: true,
};

describe("dates and times", () => {
  it("accepts only real dates", () => {
    expect(isMeetingDate("2026-11-06")).toBe(true);
    expect(isMeetingDate("2028-02-29")).toBe(true);
    expect(isMeetingDate("2026-02-30")).toBe(false);
    expect(isMeetingDate("2026-13-01")).toBe(false);
    expect(isMeetingDate("6/11/2026")).toBe(false);
    expect(isMeetingDate(["2026-11-06"])).toBe(false);
  });

  it("accepts only 24-hour HH:mm", () => {
    expect(isMeetingTime("00:00")).toBe(true);
    expect(isMeetingTime("23:59")).toBe(true);
    expect(isMeetingTime("24:00")).toBe(false);
    expect(isMeetingTime("9:00")).toBe(false);
    expect(isMeetingTime(undefined)).toBe(false);
  });

  it("uses the Bangkok calendar day whatever the device zone", () => {
    expect(toBangkokDateKey(new Date("2026-11-05T16:59:00Z"))).toBe("2026-11-05");
    expect(toBangkokDateKey(new Date("2026-11-05T17:00:00Z"))).toBe("2026-11-06");
  });
});

describe("parseMeetingParams", () => {
  it("returns the query when date and start are valid", () => {
    expect(parseMeetingParams({ date: "2026-11-05", start: "19:00", end: "21:00" })).toEqual({
      date: "2026-11-05",
      start: "19:00",
      end: "21:00",
    });
  });

  it("is null for a missing, malformed or repeated date or start", () => {
    expect(parseMeetingParams({ start: "19:00" })).toBeNull();
    expect(parseMeetingParams({ date: "2026-11-31", start: "19:00" })).toBeNull();
    expect(parseMeetingParams({ date: "2026-11-05", start: "7pm" })).toBeNull();
    expect(parseMeetingParams({ date: ["2026-11-05", "2026-11-06"], start: "19:00" })).toBeNull();
  });

  it("drops an unusable end instead of refusing the page", () => {
    expect(parseMeetingParams({ date: "2026-11-05", start: "19:00", end: "18:00" })?.end).toBeNull();
    expect(parseMeetingParams({ date: "2026-11-05", start: "19:00", end: "x" })?.end).toBeNull();
    expect(parseMeetingParams({ date: "2026-11-05", start: "19:00", end: ["20:00"] })?.end).toBeNull();
  });
});

describe("validateAdhocMeeting", () => {
  // 2026-11-06 12:00 in Bangkok.
  const now = new Date("2026-11-06T05:00:00Z");

  it("accepts a started meeting with or without an end", () => {
    expect(validateAdhocMeeting({ date: "2026-11-06", start: "10:00", end: "" }, now)).toEqual({});
    expect(validateAdhocMeeting({ date: "2026-11-05", start: "19:00", end: "21:00" }, now)).toEqual({});
  });

  it("treats the start time as Bangkok time", () => {
    expect(validateAdhocMeeting({ date: "2026-11-06", start: "12:00", end: "" }, now)).toEqual({});
    expect(validateAdhocMeeting({ date: "2026-11-06", start: "12:01", end: "" }, now).start).toBe(
      t("tutorClass.attendance.errorNotStarted"),
    );
  });

  it("refuses bad dates, future days and dates past the 120-day window", () => {
    expect(validateAdhocMeeting({ date: "", start: "10:00", end: "" }, now).date).toBe(t("tutorClass.attendance.adhocDateInvalid"));
    expect(validateAdhocMeeting({ date: "2026-11-07", start: "00:00", end: "" }, now).start).toBe(
      t("tutorClass.attendance.errorNotStarted"),
    );
    expect(validateAdhocMeeting({ date: "2026-07-09", start: "10:00", end: "" }, now)).toEqual({});
    expect(validateAdhocMeeting({ date: "2026-07-08", start: "10:00", end: "" }, now).date).toBe(
      t("tutorClass.attendance.adhocDateTooOld"),
    );
  });

  it("refuses a missing start and an end that is not after the start", () => {
    expect(validateAdhocMeeting({ date: "2026-11-05", start: "", end: "" }, now).start).toBe(
      t("tutorClass.attendance.adhocStartInvalid"),
    );
    expect(validateAdhocMeeting({ date: "2026-11-05", start: "19:00", end: "19:00" }, now).end).toBe(
      t("tutorClass.attendance.adhocEndInvalid"),
    );
    expect(validateAdhocMeeting({ date: "2026-11-05", start: "19:00", end: "18:00" }, now).end).toBeDefined();
  });
});

describe("meetingBlockReason", () => {
  const now = new Date("2026-11-06T05:00:00Z");

  it("is null when the server says the meeting can be marked", () => {
    expect(meetingBlockReason(detail, now)).toBeNull();
  });

  it("tells a future meeting from one past the make-up window", () => {
    expect(meetingBlockReason({ ...detail, markable: false, date: "2026-11-06", start: "12:01" }, now)).toBe("notStarted");
    expect(meetingBlockReason({ ...detail, markable: false, inSchedule: false, date: "2026-01-01" }, now)).toBe("tooOld");
  });

  it("does not blame the window when the device clock is ahead of the server", () => {
    expect(meetingBlockReason({ ...detail, markable: false, inSchedule: false, date: "2026-11-06", start: "11:59" }, now)).toBe("notStarted");
  });

  it("uses the same window edge as the server, and never calls a scheduled meeting too old", () => {
    const adhoc = { ...detail, markable: false, inSchedule: false };
    expect(meetingBlockReason({ ...adhoc, date: "2026-07-09" }, now)).toBe("notStarted");
    expect(meetingBlockReason({ ...adhoc, date: "2026-07-08" }, now)).toBe("tooOld");
    expect(meetingBlockReason({ ...detail, markable: false, date: "2026-01-01" }, now)).toBe("notStarted");
  });
});

describe("hrefs and labels", () => {
  it("builds the meeting link and keeps end only when given", () => {
    const href = attendanceMeetingHref("c1", { date: "2026-11-05", start: "19:00" });
    const url = new URL(href, "https://x.test");
    expect(url.pathname).toBe("/dashboard/classes/c1/attendance/meeting");
    expect(parseMeetingParams(Object.fromEntries(url.searchParams))).toEqual({ date: "2026-11-05", start: "19:00", end: null });
    expect(attendanceMeetingHref("c1", { date: "2026-11-05", start: "19:00", end: "21:00" })).toContain("end=21%3A00");
  });

  it("returns to the students tab of the class", () => {
    expect(classStudentsHref("c1")).toBe("/dashboard/classes/c1?tab=students");
  });

  it("shows the same Bangkok day the date key names", () => {
    expect(meetingDateLabel("2026-11-05")).toContain("5");
    expect(meetingDateLabel("2026-11-05")).toContain("2569");
  });

  it("formats a time with or without an end", () => {
    expect(meetingTimeLabel("19:00", "21:00")).toContain("19:00–21:00");
    expect(meetingTimeLabel("19:00", null)).not.toContain("–");
  });

  it("mentions unmarked students only when there are some", () => {
    const counts = { present: 3, late: 1, absent: 0, unmarked: 0 };
    expect(countsLabel(counts)).not.toContain(t("tutorClass.attendance.unmarked"));
    expect(countsLabel({ ...counts, unmarked: 2 })).toContain(`${t("tutorClass.attendance.unmarked")} 2`);
  });

  it("gives each status its own label and tone", () => {
    expect(statusLabel("PRESENT")).toBe("มาเรียน");
    expect(statusLabel("LATE")).toBe("มาสาย");
    expect(statusLabel("ABSENT")).toBe("ขาดเรียน");
    expect(new Set([statusTone("PRESENT"), statusTone("LATE"), statusTone("ABSENT")]).size).toBe(3);
  });

  it("never uses เข้าเรียน alone, which means joining a lesson", () => {
    const words = [t("tutorClass.attendance.title"), t("tutorClass.attendance.historyTitle"), t("tutorClass.attendance.joinedPrefix")];
    expect(words).toEqual(["เช็กชื่อ", "บันทึกการเข้าเรียน", "เข้าห้องเรียน"]);
  });
});

describe("meeting list", () => {
  it("tells unmarked, partial and complete meetings apart", () => {
    expect(meetingProgress(summary())).toBe("unmarked");
    expect(meetingProgress(summary({ marked: true, counts: { present: 1, late: 0, absent: 0, unmarked: 2 } }))).toBe("partial");
    expect(meetingProgress(summary({ marked: true, counts: { present: 3, late: 0, absent: 0, unmarked: 0 } }))).toBe("complete");
  });

  it("picks the newest meeting nobody was marked on", () => {
    const meetings = [
      summary({ date: "2026-11-06", marked: true, counts: { present: 1, late: 0, absent: 0, unmarked: 2 } }),
      summary({ date: "2026-11-05" }),
      summary({ date: "2026-11-04" }),
    ];
    expect(latestUnmarkedMeeting(meetings)?.date).toBe("2026-11-05");
  });

  it("does not nag about a meeting with no students to mark", () => {
    expect(latestUnmarkedMeeting([summary({ counts: { present: 0, late: 0, absent: 0, unmarked: 0 } })])).toBeNull();
    expect(latestUnmarkedMeeting([])).toBeNull();
  });

  it("shows chips only for meetings that differ from the schedule", () => {
    expect(hasMeetingChips(summary())).toBe(false);
    expect(hasMeetingChips(summary({ source: "ADHOC", inSchedule: false }))).toBe(true);
    expect(hasMeetingChips(summary({ movedFrom: "18:00" }))).toBe(true);
    expect(hasMeetingChips(summary({ inSchedule: false }))).toBe(true);
  });
});

describe("marking", () => {
  it("selects a status, switches it, and clears it on a second tap", () => {
    const roster = [row("a")];
    const picked = toggleMark(roster, {}, "a", "PRESENT");
    expect(picked).toEqual({ a: "PRESENT" });
    expect(toggleMark(roster, picked, "a", "LATE")).toEqual({ a: "LATE" });
    expect(toggleMark(roster, picked, "a", "PRESENT")).toEqual({});
  });

  it("records clearing a saved mark as a removal, and undoing it as no change", () => {
    const roster = [row("a", { status: "LATE" })];
    const cleared = toggleMark(roster, {}, "a", "LATE");
    expect(cleared).toEqual({ a: null });
    expect(effectiveStatus(roster[0], cleared)).toBeNull();
    expect(toggleMark(roster, cleared, "a", "LATE")).toEqual({});
  });

  it("leaves read-only and unknown rows alone", () => {
    const roster = [row("a", { enrolled: false, status: "LATE" })];
    const changes = {};
    expect(toggleMark(roster, changes, "a", "PRESENT")).toBe(changes);
    expect(toggleMark(roster, changes, "b", "PRESENT")).toBe(changes);
  });

  it("marks only unmarked enrolled students present", () => {
    const roster = [
      row("unmarked"),
      row("saved", { status: "LATE" }),
      row("edited"),
      row("cleared", { status: "PRESENT" }),
      row("left", { enrolled: false }),
    ];
    const next = markAllPresent(roster, { edited: "ABSENT", cleared: null });
    expect(next).toEqual({ unmarked: "PRESENT", edited: "ABSENT" });
    expect(hasUnmarkedStudents(roster, next)).toBe(false);
    expect(hasUnmarkedStudents(roster, {})).toBe(true);
  });

  it("does not count a read-only student as still to mark", () => {
    const roster = [row("left", { enrolled: false })];
    expect(hasUnmarkedStudents(roster, {})).toBe(false);
    expect(summarizeRoster(roster, {}).unmarked).toBe(0);
  });

  it("leaves a student who joined later out of all present and the unmarked count, but markable by hand", () => {
    const roster = [row("expected"), row("later", { joinedLater: true })];
    expect(markAllPresent(roster, {})).toEqual({ expected: "PRESENT" });
    expect(hasUnmarkedStudents([roster[1]], {})).toBe(false);
    expect(summarizeRoster(roster, {}).unmarked).toBe(1);
    expect(toggleMark(roster, {}, "later", "PRESENT")).toEqual({ later: "PRESENT" });
    expect(summarizeRoster(roster, { later: "PRESENT" })).toMatchObject({ present: 1, unmarked: 1 });
  });

  it("counts the marks as they will be after saving", () => {
    const roster = [row("a"), row("b", { status: "LATE" }), row("c", { status: "ABSENT" }), row("d", { status: "PRESENT", enrolled: false })];
    expect(summarizeRoster(roster, { a: "PRESENT", c: null })).toEqual({ present: 2, late: 1, absent: 0, unmarked: 1 });
  });

  it("keeps only edits that still apply after a reload", () => {
    const roster = [row("stays"), row("same", { status: "LATE" }), row("left", { enrolled: false })];
    expect(pruneChanges(roster, { stays: "PRESENT", same: "LATE", left: "ABSENT", gone: "ABSENT" })).toEqual({ stays: "PRESENT" });
  });
});

describe("buildSaveBody", () => {
  it("sends only the changed marks, null meaning remove", () => {
    expect(buildSaveBody(detail, { a: "PRESENT", b: null }, null)).toEqual({
      date: "2026-11-05",
      start: "19:00",
      marks: [
        { studentUserId: "a", status: "PRESENT" },
        { studentUserId: "b", status: null },
      ],
    });
  });

  it("sends the typed end only when the meeting has none", () => {
    const adhoc = { ...detail, end: null, source: "ADHOC" as const, inSchedule: false };
    expect(buildSaveBody(adhoc, {}, "20:30").end).toBe("20:30");
    expect(buildSaveBody(detail, {}, "20:30").end).toBeUndefined();
    expect(buildSaveBody(adhoc, {}, null).end).toBeUndefined();
  });

  it("drops an end that is not after the start", () => {
    expect(buildSaveBody({ ...detail, end: null }, {}, "18:00").end).toBeUndefined();
  });
});

describe("attendanceErrorMessage", () => {
  it("has a Thai message for each code the API returns", () => {
    expect(attendanceErrorMessage("MEETING_NOT_STARTED")).toBe(t("tutorClass.attendance.errorNotStarted"));
    expect(attendanceErrorMessage("STUDENT_NOT_ENROLLED")).toBe(t("tutorClass.attendance.errorNotEnrolled"));
    expect(attendanceErrorMessage("ATTENDANCE_NOT_AVAILABLE")).toBe(t("tutorClass.attendance.errorNotAvailable"));
    expect(attendanceErrorMessage("VALIDATION_FAILED")).toBe(t("tutorClass.attendance.errorInvalid"));
    expect(attendanceErrorMessage("NOT_FOUND")).toBe(t("tutorClass.setup.errorNotFound"));
    expect(attendanceErrorMessage("FORBIDDEN")).toBe(t("tutorClass.setup.errorNotFound"));
    expect(attendanceErrorMessage("UNAUTHORIZED")).toBe(t("tutorClass.setup.errorSession"));
  });

  it("falls back to a general message", () => {
    expect(attendanceErrorMessage("INTERNAL_SERVER_ERROR")).toBe(t("tutorClass.attendance.errorFailed"));
    expect(attendanceErrorMessage(null)).toBe(t("tutorClass.attendance.errorFailed"));
  });
});

describe("loadFailureKind", () => {
  it("hides the class on 404 and 403", () => {
    expect(loadFailureKind(404, "NOT_FOUND")).toBe("notFound");
    expect(loadFailureKind(403, "FORBIDDEN")).toBe("notFound");
  });

  it("recognises a class without attendance", () => {
    expect(loadFailureKind(409, "ATTENDANCE_NOT_AVAILABLE")).toBe("unavailable");
  });

  it("treats everything else as a failed load", () => {
    expect(loadFailureKind(500, "INTERNAL_SERVER_ERROR")).toBe("failed");
    expect(loadFailureKind(401, "UNAUTHORIZED")).toBe("failed");
    expect(loadFailureKind(502, null)).toBe("failed");
  });
});

describe("backGuardStep", () => {
  function run(events: BackGuardEvent[], from: BackGuardState = BACK_GUARD_START) {
    const effects: BackGuardEffect[] = [];
    let state = from;
    for (const event of events) {
      const result = backGuardStep(state, event);
      state = result.state;
      effects.push(result.effect);
    }
    return { state, effects };
  }

  it("adds one extra entry when marks become unsaved, even if told twice", () => {
    expect(run(["clean", "dirty", "dirty"]).effects).toEqual([null, "pushGuard", null]);
  });

  it("asks on back and touches no history until answered", () => {
    const { state, effects } = run(["dirty", "pop"]);
    expect(effects).toEqual(["pushGuard", null]);
    expect(state.askingBack).toBe(true);
  });

  it("restores the extra entry on cancel, so the next back asks again", () => {
    const { state, effects } = run(["dirty", "pop", "cancel", "pop"]);
    expect(effects).toEqual(["pushGuard", null, "pushGuard", null]);
    expect(state.askingBack).toBe(true);
  });

  it("leaves on confirm and then stops guarding", () => {
    const { state, effects } = run(["dirty", "pop", "confirm", "pop", "dirty"]);
    expect(effects).toEqual(["pushGuard", null, "goBack", null, null]);
    expect(state).toMatchObject({ leaving: true, askingBack: false });
  });

  it("removes the extra entry after a save and does not treat that as the user going back", () => {
    const { state, effects } = run(["dirty", "clean", "pop"]);
    expect(effects).toEqual(["pushGuard", "goBack", null]);
    expect(state).toEqual(BACK_GUARD_START);
  });

  it("does not ask when a back arrives with nothing unsaved", () => {
    expect(run(["pop"]).state).toEqual(BACK_GUARD_START);
  });

  it("guards again when marks return before its own back has landed", () => {
    const { state, effects } = run(["dirty", "clean", "dirty", "pop", "pop"]);
    expect(effects).toEqual(["pushGuard", "goBack", null, "pushGuard", null]);
    expect(state).toMatchObject({ dirty: true, onGuardEntry: false, askingBack: true });
  });

  it("ignores a dialog answer when back was not what it asked about", () => {
    expect(run(["dirty", "cancel"]).effects).toEqual(["pushGuard", null]);
    expect(run(["dirty", "confirm"]).effects).toEqual(["pushGuard", null]);
  });

  it("closes the question if the marks stop being unsaved", () => {
    expect(run(["dirty", "pop", "clean"]).state).toEqual(BACK_GUARD_START);
  });
});

describe("guardedLinkTarget", () => {
  const current = "https://tutor.test/dashboard/classes/c1/attendance/meeting?date=2026-11-05&start=19:00";
  const link = { target: "", download: false, modified: false };

  it("asks before following an in-app link", () => {
    expect(guardedLinkTarget({ ...link, href: "https://tutor.test/dashboard/classes/c1/attendance" }, current)).toBe(
      "/dashboard/classes/c1/attendance",
    );
    expect(guardedLinkTarget({ ...link, href: "/dashboard?x=1#top", target: "_self" }, current)).toBe("/dashboard?x=1#top");
  });

  it("leaves other sites, new tabs, downloads and modified clicks to the browser", () => {
    expect(guardedLinkTarget({ ...link, href: "https://other.test/" }, current)).toBeNull();
    expect(guardedLinkTarget({ ...link, href: "/dashboard", target: "_blank" }, current)).toBeNull();
    expect(guardedLinkTarget({ ...link, href: "/file.pdf", download: true }, current)).toBeNull();
    expect(guardedLinkTarget({ ...link, href: "/dashboard", modified: true }, current)).toBeNull();
  });

  it("ignores a link to this same page", () => {
    expect(guardedLinkTarget({ ...link, href: `${current}#list` }, current)).toBeNull();
  });
});
