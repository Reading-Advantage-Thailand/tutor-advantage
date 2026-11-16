/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canTakeFocus, focusIsLost, guardFocusAfterClose, resolveFinalFocus } from "./finalFocus";

/** jsdom has no layout: give elements one client rect so they count as rendered. */
function rendered<T extends HTMLElement>(element: T): T {
  element.getClientRects = () => [{}] as unknown as DOMRectList;
  return element;
}

describe("finalFocus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves an element, a ref or a function", () => {
    const element = document.createElement("button");
    expect(resolveFinalFocus(element)).toBe(element);
    expect(resolveFinalFocus({ current: element })).toBe(element);
    expect(resolveFinalFocus(() => element)).toBe(element);
    expect(resolveFinalFocus(() => undefined)).toBeNull();
    expect(resolveFinalFocus(undefined)).toBeNull();
  });

  it("only takes focus on a connected, enabled, rendered element", () => {
    const button = rendered(document.createElement("button"));
    expect(canTakeFocus(button)).toBe(false); // not on the page
    document.body.append(button);
    expect(canTakeFocus(button)).toBe(true);
    button.disabled = true;
    expect(canTakeFocus(button)).toBe(false);
    const hidden = document.createElement("button"); // no client rects = display:none
    document.body.append(hidden);
    expect(canTakeFocus(hidden)).toBe(false);
  });

  it("moves focus to the target once the opener is removed, then stops", () => {
    const opener = rendered(document.createElement("button"));
    const search = rendered(document.createElement("input"));
    document.body.append(opener, search);
    opener.focus();
    guardFocusAfterClose(() => search);
    vi.advanceTimersByTime(300);
    expect(document.activeElement).toBe(opener); // still on the page: left alone
    opener.remove(); // the list refresh removed the row
    expect(focusIsLost()).toBe(true);
    vi.advanceTimersByTime(150);
    expect(document.activeElement).toBe(search);
    search.blur();
    vi.advanceTimersByTime(500);
    expect(document.activeElement).toBe(document.body); // the guard has stopped
  });

  it("leaves focus alone after the user presses a key", () => {
    const search = rendered(document.createElement("input"));
    document.body.append(search);
    guardFocusAfterClose(() => search);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    vi.advanceTimersByTime(500);
    expect(document.activeElement).toBe(document.body);
  });

  it("gives up after the timeout", () => {
    const search = rendered(document.createElement("input"));
    guardFocusAfterClose(() => search, 1000);
    vi.advanceTimersByTime(1200);
    document.body.append(search);
    vi.advanceTimersByTime(500);
    expect(document.activeElement).toBe(document.body);
  });
});
