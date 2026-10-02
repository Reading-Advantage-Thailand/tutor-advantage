"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/mobile";
import { LessonWrapUpPhase } from "@/components/lesson/phases/LessonWrapUpPhase";
import type { LessonParticipant } from "@/hooks/useLessonSocket";

type Scenario = "first" | "tiedTop" | "middle" | "last" | "allZero";

const p = (studentId: string, name: string, score?: number): LessonParticipant => ({ studentId, name, score, isReady: true });

// "me" is the viewing student in every scenario.
const SCENARIOS: Record<Scenario, { label: string; participants: LessonParticipant[] }> = {
  first: { label: "ที่ 1", participants: [p("a", "ไอซ์", 30), p("me", "เอก", 45), p("b", "น้ำ", 20), p("c", "มายด์", 0)] },
  tiedTop: { label: "เสมอ", participants: [p("a", "ไอซ์", 40), p("me", "เอก", 40), p("b", "น้ำ", 20), p("c", "มายด์", 20), p("d", "ต้น", 10)] },
  middle: { label: "กลาง", participants: [p("a", "ไอซ์", 50), p("b", "น้ำ", 40), p("c", "มายด์", 30), p("me", "เอก", 25), p("d", "ต้น", 10), p("e", "บีม", 5), p("f", "ฝน", 0), p("g", "โอ๊ต", 0)] },
  last: { label: "ท้าย", participants: [p("a", "ไอซ์", 30), p("b", "น้ำ", 20), p("c", "มายด์", 10), p("me", "เอก", 0)] },
  allZero: { label: "ศูนย์", participants: [p("me", "เอก", 0), p("a", "ไอซ์", 0), p("b", "น้ำ"), p("c", "มายด์", 0)] },
};

/** Live-lesson wrap-up for several class outcomes (tiered copy, shared ranks, medals only for scorers). */
export function LeaderboardDemo() {
  const [scenario, setScenario] = useState<Scenario>("last");
  return (
    <div className="space-y-3" data-testid="wrapup-demo">
      <SegmentedControl
        aria-label="ผลการเรียน"
        items={(Object.keys(SCENARIOS) as Scenario[]).map((value) => ({ value, label: SCENARIOS[value].label }))}
        value={scenario}
        onChange={setScenario}
      />
      <LessonWrapUpPhase key={scenario} participants={SCENARIOS[scenario].participants} studentId="me" classBookCycleId="demo" articleId="demo" />
    </div>
  );
}
