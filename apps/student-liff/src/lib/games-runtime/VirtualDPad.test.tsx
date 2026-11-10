// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VirtualDPad } from "./VirtualDPad";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type FakeTouch = { identifier: number; clientX: number; clientY: number };

const CENTER = { x: 100, y: 100 };

describe("VirtualDPad", () => {
  let container: HTMLDivElement;
  let root: Root;
  let stick: HTMLElement;
  const onInput = vi.fn();

  const last = () => onInput.mock.calls[onInput.mock.calls.length - 1][0] as { dx: number; dy: number };

  const fire = (type: string, touches: FakeTouch[], changed: FakeTouch[]) =>
    act(() => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches, changedTouches: changed, targetTouches: touches });
      stick.dispatchEvent(event);
    });

  const finger = (identifier: number, dx: number, dy: number): FakeTouch => ({
    identifier,
    clientX: CENTER.x + dx,
    clientY: CENTER.y + dy,
  });

  beforeEach(() => {
    onInput.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<VirtualDPad onInput={onInput} />));
    stick = container.firstElementChild as HTMLElement;
    stick.getBoundingClientRect = () =>
      ({ left: CENTER.x - 64, top: CENTER.y - 64, width: 128, height: 128 }) as DOMRect;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("sends a full-length direction at any angle, with no snap to a diagonal", () => {
    const thumb = finger(1, 30, 10);
    fire("touchstart", [thumb], [thumb]);
    expect(Math.hypot(last().dx, last().dy)).toBeCloseTo(1);
    expect((Math.atan2(last().dy, last().dx) * 180) / Math.PI).toBeCloseTo(18.43, 1);
  });

  it("follows the finger that started on it when another finger is on the screen", () => {
    const elsewhere = { identifier: 7, clientX: 900, clientY: 40 };
    const thumb = finger(2, -30, 0);
    // The other finger is first in e.touches, which used to steer the stick.
    fire("touchstart", [elsewhere, thumb], [thumb]);
    expect(last()).toEqual({ dx: -1, dy: 0 });

    const moved = finger(2, 0, -30);
    fire("touchmove", [{ ...elsewhere, clientX: 950 }, moved], [moved]);
    expect(last()).toEqual({ dx: 0, dy: -1 });
  });

  it("does not hand over to a second finger on the stick", () => {
    const first = finger(1, 30, 0);
    fire("touchstart", [first], [first]);
    const second = finger(2, -30, 0);
    fire("touchstart", [first, second], [second]);
    expect(last()).toEqual({ dx: 1, dy: 0 });

    // The second finger lifting does not stop the first.
    onInput.mockClear();
    fire("touchend", [first], [second]);
    expect(onInput).not.toHaveBeenCalled();

    fire("touchend", [], [first]);
    expect(last()).toEqual({ dx: 0, dy: 0 });
  });

  it("stops on touchcancel", () => {
    const thumb = finger(1, 30, 0);
    fire("touchstart", [thumb], [thumb]);
    fire("touchcancel", [], [thumb]);
    expect(last()).toEqual({ dx: 0, dy: 0 });
  });

  it("stops when the finger is no longer on the screen", () => {
    const thumb = finger(1, 30, 0);
    fire("touchstart", [thumb], [thumb]);
    const other = finger(9, 0, 30);
    fire("touchmove", [other], [other]);
    expect(last()).toEqual({ dx: 0, dy: 0 });
  });

  it("stops when the page is hidden, and can be used again afterwards", () => {
    const thumb = finger(1, 30, 0);
    fire("touchstart", [thumb], [thumb]);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(last()).toEqual({ dx: 0, dy: 0 });
    visibility.mockRestore();

    const again = finger(3, 0, 30);
    fire("touchstart", [again], [again]);
    expect(last()).toEqual({ dx: 0, dy: 1 });
  });

  it("does not freeze on a window blur with the finger still down", () => {
    const thumb = finger(1, 30, 0);
    fire("touchstart", [thumb], [thumb]);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    const moved = finger(1, 0, 30);
    fire("touchmove", [moved], [moved]);
    expect(last()).toEqual({ dx: 0, dy: 1 });
  });

  it("ignores the fake mouse press a phone sends after a tap", () => {
    const thumb = finger(1, 30, 0);
    fire("touchstart", [thumb], [thumb]);
    fire("touchend", [], [thumb]);
    onInput.mockClear();
    act(() => {
      stick.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 130, clientY: 100 }));
    });
    expect(onInput).not.toHaveBeenCalled();
  });

  it("still works with a real mouse", () => {
    act(() => {
      stick.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 130, clientY: 100 }));
    });
    expect(last()).toEqual({ dx: 1, dy: 0 });
    act(() => {
      stick.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    expect(last()).toEqual({ dx: 0, dy: 0 });
  });
});
