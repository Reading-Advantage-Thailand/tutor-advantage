// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playNotificationSound = vi.fn();
vi.mock("../../../lib/sounds", () => ({ playNotificationSound: () => playNotificationSound() }));

import { useUnreadChime } from "./useUnreadChime";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ cacheKey, unread }: { cacheKey: string | null; unread: number | undefined }) {
  useUnreadChime(cacheKey, unread);
  return null;
}

describe("useUnreadChime", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    playNotificationSound.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (cacheKey: string | null, unread: number | undefined) =>
    act(() => root.render(<Probe cacheKey={cacheKey} unread={unread} />));

  it("does not chime for the first value (fresh load or cached tab revisit)", () => {
    render("u:dashboard", undefined);
    render("u:dashboard", 4);
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it("chimes when the count grows while mounted", () => {
    render("u:dashboard", 2);
    render("u:dashboard", 3);
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    render("u:dashboard", 3);
    render("u:dashboard", 1);
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("does not chime after a remount with the same cached value", () => {
    render("u:dashboard", 5);
    act(() => root.unmount());
    root = createRoot(container);
    render("u:dashboard", 5);
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it("resets the baseline when the key changes", () => {
    render("a:dashboard", 1);
    render("b:dashboard", 9);
    expect(playNotificationSound).not.toHaveBeenCalled();
    render("b:dashboard", 10);
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });
});
