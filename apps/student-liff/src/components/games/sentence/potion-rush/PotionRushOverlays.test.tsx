// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePotionRushStore, type Customer, type SentenceItem } from "@/store/usePotionRushStore";

import { DragHint, GameHint, OrderBanner, RoundTimer } from "./PotionRushOverlays";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const english: SentenceItem = { id: "1", term: "We learn new words.", translation: "We learn new words." };
const thai: SentenceItem = { ...english, id: "2", thaiTranslation: "เราเรียนคำใหม่" };
const pot = { from: { x: 0, y: 700 }, potCentres: [{ x: 60, y: 300 }, { x: 180, y: 300 }, { x: 300, y: 300 }] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] };

const customer = (request: SentenceItem, overrides: Partial<Customer> = {}): Customer => ({
  id: "c1",
  type: "wizard",
  request,
  patience: 30,
  maxPatience: 30,
  state: "WAITING",
  ...overrides,
});

describe("Potion Rush overlays", () => {
  let container: HTMLDivElement;
  let root: Root;
  const plays: string[] = [];

  const renderBanner = (promptEnabled = true) =>
    act(() => {
      root.render(<OrderBanner top={44} left={8} right={8} slotCentres={[57, 187, 317]} promptEnabled={promptEnabled} />);
    });
  const seat = (request: SentenceItem, overrides: Partial<Customer> = {}, placed: string[] = []) =>
    act(() => {
      usePotionRushStore.setState((state) => ({
        customers: [customer(request, overrides), null, null],
        cauldrons: state.cauldrons.map((c, i) =>
          i === 0 && placed.length > 0 ? { ...c, state: "BREWING" as const, currentWords: placed, targetSentence: request } : c,
        ),
      }));
    });
  const text = () => container.textContent ?? "";

  beforeEach(() => {
    vi.useFakeTimers();
    plays.length = 0;
    vi.stubGlobal(
      "Audio",
      class {
        src = "";
        play() {
          plays.push(this.src);
          return Promise.resolve();
        }
        pause() {}
      },
    );
    usePotionRushStore.getState().reset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the English for a moment, then blanks it behind a replay button", () => {
    seat(english);
    renderBanner();
    expect(text()).toContain("We");
    expect(text()).toContain("words.");

    act(() => vi.advanceTimersByTime(8_000));
    expect(text()).not.toContain("words.");
    expect(text()).toContain("ดูประโยคอีกครั้ง");
    expect(text()).toContain("___");

    act(() => container.querySelector("button")?.click());
    expect(text()).toContain("words.");
  });

  it("keeps showing the words already in the pot while the rest is hidden", () => {
    seat(english, {}, ["We", "learn"]);
    renderBanner();
    act(() => vi.advanceTimersByTime(8_000));
    expect(text()).toContain("We");
    expect(text()).toContain("learn");
    expect(text()).not.toContain("words.");
  });

  it("shows stored Thai all round, with the English only as blanks", () => {
    seat(thai);
    renderBanner();
    act(() => vi.advanceTimersByTime(20_000));
    expect(text()).toContain("เราเรียนคำใหม่");
    expect(text()).not.toContain("words.");
    expect(text()).not.toContain("ดูประโยคอีกครั้ง");
  });

  it("shows a finished order in full and plays it once more", () => {
    const withAudio = { ...thai, audioUrl: "a.mp3" };
    seat(withAudio);
    renderBanner();
    expect(plays).toEqual(["a.mp3"]);
    seat(withAudio, { state: "LEAVING_HAPPY" });
    expect(text()).toContain("✓ We learn new words.");
    expect(plays).toEqual(["a.mp3", "a.mp3"]);
  });

  it("plays nothing on its own and never hides the text in a tutor demo", () => {
    seat({ ...english, audioUrl: "a.mp3" });
    renderBanner(false);
    act(() => vi.advanceTimersByTime(20_000));
    expect(text()).toContain("words.");
    expect(plays).toEqual([]);
    seat({ ...english, audioUrl: "a.mp3" }, { state: "LEAVING_HAPPY" });
    expect(plays).toEqual([]);
  });

  it("says so when nobody is at the counter", () => {
    renderBanner();
    expect(text()).toContain("รอลูกค้าคนถัดไป");
  });

  it("moves the arrow to the customer being worked for", () => {
    act(() => {
      usePotionRushStore.setState({ customers: [null, customer(english), null], focusedSlot: 1 });
    });
    renderBanner();
    const arrow = container.querySelector<HTMLElement>("span[aria-hidden][style*='left']");
    expect(arrow?.style.left).toBe("187px");
  });

  it("counts whole seconds down", () => {
    act(() => {
      usePotionRushStore.setState({ gameTime: 12.4 });
      root.render(<RoundTimer />);
    });
    expect(text()).toBe("48s");
  });

  it("shows a hint for a moment, and the same text again when asked again", () => {
    act(() => root.render(<GameHint top={400} />));
    act(() => usePotionRushStore.getState().showHint("วางลงในหม้อ"));
    expect(text()).toContain("วางลงในหม้อ");
    act(() => vi.advanceTimersByTime(2_000));
    expect(text()).toBe("");
    act(() => usePotionRushStore.getState().showHint("วางลงในหม้อ"));
    expect(text()).toContain("วางลงในหม้อ");
  });

  it("stops showing the drag finger after the first word goes in", () => {
    usePotionRushStore.getState().startGame([english], "normal");
    act(() => root.render(<DragHint from={pot.from} potCentres={pot.potCentres} />));
    expect(container.querySelector('[data-testid="potion-drag-hint"]')).not.toBeNull();
    act(() => {
      usePotionRushStore.setState({ placedWords: 1 });
    });
    expect(container.querySelector('[data-testid="potion-drag-hint"]')).toBeNull();
  });
});
