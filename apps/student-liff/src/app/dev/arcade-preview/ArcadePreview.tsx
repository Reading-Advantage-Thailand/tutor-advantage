"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LazyArcadeRuntime } from "@/components/lesson/gameRegistry";
import type { LiveLessonGameCategory } from "@/lib/liveLessonGames";

const ARTICLE = {
  words: [
    { id: "w1", vocabulary: "forest", translation: "ป่า" },
    { id: "w2", vocabulary: "ancient", translation: "โบราณ" },
    { id: "w3", vocabulary: "journey", translation: "การเดินทาง" },
    { id: "w4", vocabulary: "crystal", translation: "คริสตัล" },
    { id: "w5", vocabulary: "dragon", translation: "มังกร" },
    { id: "w6", vocabulary: "shield", translation: "โล่" },
  ],
  sentences: [
    { id: "s1", sentence: "The dragon flew over the forest", translation: "มังกรบินข้ามป่า" },
    { id: "s2", sentence: "We started a long journey", translation: "เราเริ่มการเดินทางที่ยาวไกล" },
  ],
};

function Preview() {
  const params = useSearchParams();
  const gameId = params.get("game") || "dragon-flight";
  const category = (params.get("category") || "vocabulary") as LiveLessonGameCategory;
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="relative">
      {result ? (
        <p data-testid="arcade-result" className="fixed top-2 left-2 z-[100] rounded bg-black/70 px-2 py-1 text-xs text-white">
          {result}
        </p>
      ) : null}
      {/* Inline onComplete on purpose: mirrors the play page, which passes a new callback every render. */}
      <LazyArcadeRuntime
        gameId={gameId}
        category={category}
        articleData={ARTICLE}
        restartOnComplete={false}
        onComplete={(r) => setResult(JSON.stringify(r))}
      />
    </div>
  );
}

/** Dev-only QA screen mounting any live-lesson arcade game through the real runtime (?game=dragon-flight). */
export function ArcadePreview() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
