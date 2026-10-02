import { describe, expect, it } from "vitest";
import { getGamePrimaryAction, type GamePrimaryActionInput } from "./gamePrimaryAction";

const base: GamePrimaryActionInput = {
  status: undefined,
  hasPlayableGame: true,
  teacherDemoEnabled: false,
  tutorialEnabled: true,
  stateTutorialEnabled: true,
  preparationMode: false,
  preparationFreeExplore: false,
  votesCount: 0,
  totalParticipants: 3,
};

describe("getGamePrimaryAction", () => {
  it("walks the live game flow", () => {
    expect(getGamePrimaryAction(base)).toEqual({ label: "เปิดโหวตเกม", disabled: false });
    expect(getGamePrimaryAction({ ...base, status: "voting" })).toEqual({ label: "ปิดโหวตและดูผล", disabled: false });
    expect(getGamePrimaryAction({ ...base, status: "ready" }).label).toBe("แสดง Tutorial");
    expect(getGamePrimaryAction({ ...base, status: "ready", teacherDemoEnabled: true }).label).toBe("เริ่มให้ครูสาธิต");
    expect(getGamePrimaryAction({ ...base, status: "ready", tutorialEnabled: false }).label).toBe("เริ่มเกมทันที");
    expect(getGamePrimaryAction({ ...base, status: "teacher_demo" }).label).toBe("จบการสาธิต ไป Tutorial");
    expect(getGamePrimaryAction({ ...base, status: "teacher_demo", stateTutorialEnabled: false }).label).toBe("จบการสาธิตและเริ่มเกม");
    expect(getGamePrimaryAction({ ...base, status: "tutorial" })).toEqual({ label: "เริ่มเกม", disabled: false });
    expect(getGamePrimaryAction({ ...base, status: "countdown" }).disabled).toBe(true);
    expect(getGamePrimaryAction({ ...base, status: "playing" }).disabled).toBe(true);
  });

  it("blocks voting when no game is playable", () => {
    expect(getGamePrimaryAction({ ...base, status: "voting", hasPlayableGame: false })).toEqual({
      label: "เกมอื่นๆ จะเปิดให้เล่นเร็วๆนี้",
      disabled: true,
    });
  });

  it("waits for all mock votes in rehearsal, but not in free explore", () => {
    const rehearsal = { ...base, status: "voting", preparationMode: true, votesCount: 2, totalParticipants: 4 };
    expect(getGamePrimaryAction(rehearsal).disabled).toBe(true);
    expect(getGamePrimaryAction({ ...rehearsal, votesCount: 4 }).disabled).toBe(false);
    expect(getGamePrimaryAction({ ...rehearsal, preparationFreeExplore: true }).disabled).toBe(false);
    expect(getGamePrimaryAction({ ...base, status: "playing", preparationMode: true, preparationFreeExplore: true })).toEqual({
      label: "ดูผลตัวอย่างทันที",
      disabled: false,
    });
  });
});
