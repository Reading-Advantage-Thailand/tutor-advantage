// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const started = { osc: 0, noise: 0 };

function param() {
  return {
    value: 1,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function node() {
  return { connect: vi.fn(), gain: param(), frequency: param(), type: "", buffer: null as unknown };
}

class FakeAudioContext {
  static created = 0;
  state: AudioContextState = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  constructor() {
    FakeAudioContext.created++;
  }
  resume = vi.fn(() => Promise.resolve());
  createGain = () => node();
  createBiquadFilter = () => node();
  createOscillator = () => ({ ...node(), start: () => void started.osc++, stop: vi.fn() });
  createBufferSource = () => ({ ...node(), start: () => void started.noise++, stop: vi.fn() });
  createBuffer = (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
}

async function freshModule() {
  vi.resetModules();
  return import("./useSound");
}

describe("playGameSound", () => {
  const audioFile = vi.fn();

  beforeEach(() => {
    started.osc = 0;
    started.noise = 0;
    FakeAudioContext.created = 0;
    audioFile.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("Audio", audioFile);
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("synthesizes every sound and never asks for a file", async () => {
    const { playGameSound } = await freshModule();
    const types = ["success", "error", "missile-hit", "bubbling", "clinking", "angry-grunt", "cash-register"] as const;
    for (const type of types) {
      const before = started.osc;
      playGameSound(type);
      expect(started.osc).toBeGreaterThan(before);
    }
    expect(started.noise).toBe(1);
    expect(audioFile).not.toHaveBeenCalled();
    expect(FakeAudioContext.created).toBe(1);
  });

  it("plays one press once, and a later press again", async () => {
    const { playGameSound } = await freshModule();
    playGameSound("success");
    const once = started.osc;
    playGameSound("success");
    playGameSound("success");
    expect(started.osc).toBe(once);

    vi.setSystemTime(1_000_200);
    playGameSound("success");
    expect(started.osc).toBe(once * 2);
  });

  it("does not save up sounds while audio is locked", async () => {
    const { playGameSound } = await freshModule();
    const locked = vi.fn(() => new Promise<void>(() => undefined));
    class LockedContext extends FakeAudioContext {
      state: AudioContextState = "suspended";
      resume = locked;
    }
    window.AudioContext = LockedContext as unknown as typeof AudioContext;
    playGameSound("error");
    expect(locked).toHaveBeenCalled();
    expect(started.osc).toBe(0);
  });

  it("stays silent where there is no audio", async () => {
    const { playGameSound } = await freshModule();
    window.AudioContext = undefined as unknown as typeof AudioContext;
    expect(() => playGameSound("success")).not.toThrow();
    expect(audioFile).not.toHaveBeenCalled();
  });
});
