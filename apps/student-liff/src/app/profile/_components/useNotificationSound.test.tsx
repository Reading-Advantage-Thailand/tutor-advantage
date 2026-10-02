// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NOTIFICATION_MUTE_KEY } from "../../../lib/sounds";
import { useNotificationSound } from "./useNotificationSound";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof useNotificationSound>;
function Probe() {
  latest = useNotificationSound();
  return null;
}

describe("useNotificationSound", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("is on by default", () => {
    act(() => root.render(<Probe />));
    expect(latest[0]).toBe(true);
  });

  it("reads an existing mute", () => {
    localStorage.setItem(NOTIFICATION_MUTE_KEY, "true");
    act(() => root.render(<Probe />));
    expect(latest[0]).toBe(false);
  });

  it("writes the same key playNotificationSound reads", () => {
    act(() => root.render(<Probe />));
    act(() => latest[1](false));
    expect(localStorage.getItem(NOTIFICATION_MUTE_KEY)).toBe("true");
    expect(latest[0]).toBe(false);
    act(() => latest[1](true));
    expect(localStorage.getItem(NOTIFICATION_MUTE_KEY)).toBe("false");
    expect(latest[0]).toBe(true);
  });
});
