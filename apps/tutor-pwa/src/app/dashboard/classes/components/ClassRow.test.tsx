import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The DEV delete button pulls in the class server actions; these rows never show it.
vi.mock("./DeleteClassButton", () => ({ DeleteClassButton: () => null }));

import { ClassRow, type ClassListItem } from "./ClassRow";

const base: ClassListItem = { id: "c1", name: "English", book: "Primary Origins 2", status: "open", students: 4, maxStudents: 30 };

/** ListRow's `actions` layer: the only part of the row that sits above the stretched row link. */
const ACTIONS_OPEN = '<span class="pointer-events-none relative z-10';

/** From the actions layer to its last link (the setup link is the last link in the row). */
function actionsLayer(html: string) {
  const start = html.indexOf(ACTIONS_OPEN);
  return start < 0 ? "" : html.slice(start, html.lastIndexOf("</a>"));
}

describe("ClassRow", () => {
  it("puts the setup chip in the meta line, under the row link; only the setup link is an action", () => {
    const html = renderToStaticMarkup(<ClassRow cls={{ ...base, setupRequired: true }} />);
    const actionsAt = html.indexOf(ACTIONS_OPEN);
    const chipAt = html.indexOf("รอตั้งค่า");
    expect(chipAt).toBeGreaterThan(-1);
    expect(actionsAt).toBeGreaterThan(-1);
    // One chip, before the actions layer (so a tap on it lands on the stretched link).
    expect(html.match(/รอตั้งค่า/g)).toHaveLength(1);
    expect(chipAt).toBeLessThan(actionsAt);
    const actions = actionsLayer(html);
    expect(actions).toContain('href="/dashboard/classes/c1/setup"');
    expect(actions).toContain("ตั้งค่าห้องเรียน");
    expect(actions).not.toContain("รอตั้งค่า");
  });

  it("has no setup chip and no actions layer on a class that is set up", () => {
    const html = renderToStaticMarkup(<ClassRow cls={base} />);
    expect(html).not.toContain("รอตั้งค่า");
    expect(html).not.toContain(ACTIONS_OPEN);
  });

  it("shows the whole schedule line: it wraps, it is not cut to one line", () => {
    const schedule = "5 ต.ค. 69 - 30 พ.ย. 69 (รวม 12 วัน) เวลา 18:00-20:00 น.";
    const html = renderToStaticMarkup(<ClassRow cls={{ ...base, nextSession: schedule }} />);
    const line = html.match(/<span class="([^"]*)">5 ต\.ค\. 69 - 30 พ\.ย\. 69 /)?.[1] ?? "";
    expect(line.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "break-words"]));
    expect(line).not.toContain("truncate");
    // The day count and the time range each stay on one line when the text wraps.
    expect(html).toContain('<span class="whitespace-nowrap">(รวม 12 วัน)</span>');
    expect(html).toContain('<span class="whitespace-nowrap">เวลา 18:00-20:00 น.</span>');
  });
});
