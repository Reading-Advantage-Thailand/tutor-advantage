import { describe, expect, it } from "vitest";
import {
  buildClassIcs,
  buildGoogleCalendarUrl,
  firstOccurrence,
  formatCalendarDateTime,
  icsFileName,
  parseScheduleForCalendar,
} from "./classCalendar";

// Local-time dates keep these tests independent of the machine's time zone.
const localIso = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString();

describe("parseScheduleForCalendar", () => {
  it("reads Thai weekdays in map order and the first time range", () => {
    expect(parseScheduleForCalendar("ทุกวันเสาร์ และ จันทร์ 09:30 - 11:00 น.")).toEqual({
      days: [1, 6],
      sh: 9,
      sm: 30,
      eh: 11,
      em: 0,
    });
  });

  it("treats พฤหัส and พฤหัสบดี as one Thursday", () => {
    expect(parseScheduleForCalendar("วันพฤหัสบดี 18:00–20:00").days).toEqual([4]);
  });

  it("defaults to Monday 19:00–21:00 when nothing matches", () => {
    expect(parseScheduleForCalendar("Local sample schedule")).toEqual({ days: [1], sh: 19, sm: 0, eh: 21, em: 0 });
  });
});

describe("firstOccurrence", () => {
  it("moves forward to the first scheduled weekday at local midnight", () => {
    // 2026-10-02 is a Friday; first Saturday is the 3rd.
    const first = firstOccurrence(new Date(2026, 9, 2, 15, 45), [6]);
    expect([first.getFullYear(), first.getMonth(), first.getDate(), first.getHours()]).toEqual([2026, 9, 3, 0]);
  });

  it("keeps the anchor day when it already matches", () => {
    const first = firstOccurrence(new Date(2026, 9, 2, 8), [5]);
    expect(first.getDate()).toBe(2);
  });
});

describe("buildClassIcs", () => {
  const now = new Date(Date.UTC(2026, 9, 1, 3, 4, 5));

  it("builds a weekly event on the first matching day with an UNTIL date and alarm", () => {
    const ics = buildClassIcs(
      {
        id: "class-1",
        name: "Reading A1",
        schedule: "จันทร์ พุธ 18:00 - 19:30\nออนไลน์",
        startsAt: localIso(2026, 10, 2),
        endsAt: "2026-12-31T00:00:00.000Z",
      },
      now,
    );
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("UID:class-1@ta.th");
    expect(lines).toContain("DTSTAMP:20261001T030405Z");
    // Friday 2 Oct → Monday 5 Oct.
    expect(lines).toContain("DTSTART;TZID=Asia/Bangkok:20261005T180000");
    expect(lines).toContain("DTEND;TZID=Asia/Bangkok:20261005T193000");
    expect(lines).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T000000Z");
    expect(lines).toContain("SUMMARY:Reading A1");
    expect(lines).toContain("DESCRIPTION:จันทร์ พุธ 18:00 - 19:30\\nออนไลน์");
    expect(lines).toContain("TRIGGER:-PT30M");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });

  it("anchors on `now` and omits UNTIL without dates", () => {
    const ics = buildClassIcs({ id: "c", name: "x", schedule: "เสาร์" }, new Date(2026, 9, 2, 12));
    expect(ics).toContain("DTSTART;TZID=Asia/Bangkok:20261003T190000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SA\r\n");
  });
});

describe("buildGoogleCalendarUrl", () => {
  it("uses the start date itself and URL-encodes name, details and BYDAY commas", () => {
    const url = buildGoogleCalendarUrl({
      name: "คลาส A & B",
      schedule: "อังคาร ศุกร์ 17:00-18:00",
      startsAt: localIso(2026, 10, 2),
    });
    expect(url).toBe(
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
        `&text=${encodeURIComponent("คลาส A & B")}` +
        "&dates=20261002T170000/20261002T180000" +
        "&recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3DTU%2CFR" +
        `&details=${encodeURIComponent("อังคาร ศุกร์ 17:00-18:00")}`,
    );
  });
});

describe("small helpers", () => {
  it("formats local date-times and file names", () => {
    expect(formatCalendarDateTime(new Date(2026, 0, 5), 7, 5)).toBe("20260105T070500");
    expect(icsFileName("Reading  A1 class")).toBe("Reading-A1-class.ics");
  });
});
