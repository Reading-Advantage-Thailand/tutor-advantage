// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// The stage pulls in every teaching game; the monitor and vote board need none of them.
vi.mock("@/components/lesson/teachingGameRegistry", () => ({
  TeachingGameStage: () => null,
  isTeachingGameId: () => false,
}));

import { GamePhaseStage, type GamePhaseStageProps } from "./GamePhaseStage";
import type { GamePhaseState, Participant } from "@/lib/lesson-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const classOf = (count: number): Participant[] =>
  Array.from({ length: count }, (_, index) => ({ studentId: `s${index}`, name: `นักเรียน ${index + 1}`, score: 0 }));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function render(gameState: GamePhaseState, participants: Participant[], category: GamePhaseStageProps["category"] = "vocabulary") {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <GamePhaseStage
        category={category}
        currentPhase={category === "vocabulary" ? 10 : 14}
        gameState={gameState}
        participants={participants}
        totalParticipants={participants.length}
        submittedCount={0}
        isFullscreen={true}
        teacherDemoEnabled={false}
        onTeacherDemoEnabledChange={() => {}}
        tutorialEnabled={true}
        onTutorialEnabledChange={() => {}}
        teacherDemoAnswer={null}
        onTeacherDemoAnswer={() => {}}
        potionRushTeacherDemoCompleted={false}
        onPotionRushTeacherDemoComplete={() => {}}
        roster={null}
      />,
    );
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("live monitor on the projector", () => {
  it("counts down the time the phones have left", () => {
    const now = Date.now();
    const view = render(
      { phase: 10, category: "vocabulary", status: "playing", votes: {}, results: {}, selectedGameId: "wizard-vs-zombie", playingStartedAt: now - 20_000, serverNow: now },
      classOf(4),
    );
    const timer = view.querySelector('[role="timer"]');
    expect(timer?.textContent).toContain("0:40");
    expect(timer?.textContent).toContain("เวลาที่เหลือ");
  });

  it("puts a class of 32 in a grid instead of one long column", () => {
    const view = render({ phase: 10, category: "vocabulary", status: "playing", votes: {}, results: {}, selectedGameId: "rune-match", playingStartedAt: Date.now() }, classOf(32));
    const list = [...view.querySelectorAll("ol")].find((ol) => ol.children.length === 32);
    expect(list).toBeTruthy();
    expect(list!.className).toContain("grid");
  });

  it("lists a small class in one column", () => {
    const view = render({ phase: 10, category: "vocabulary", status: "playing", votes: {}, results: {}, selectedGameId: "rune-match", playingStartedAt: Date.now() }, classOf(5));
    const list = [...view.querySelectorAll("ol")].find((ol) => ol.children.length === 5);
    expect(list!.className).not.toContain("grid");
  });
});

describe("sentence vote board", () => {
  it("folds the locked games into one line under the playable ones", () => {
    const view = render({ phase: 14, category: "sentence", status: "voting", votes: {}, results: {} }, classOf(3), "sentence");
    const rows = [...view.querySelectorAll("li")];
    const lockedLines = rows.filter((row) => /^\+\d+/.test(row.textContent?.trim() ?? ""));
    expect(lockedLines).toHaveLength(1);
    expect(rows.length).toBeLessThanOrEqual(3);
    expect([...view.querySelectorAll("img")].every((img) => img.getAttribute("src")?.endsWith(".webp"))).toBe(true);
  });
});
