"use client";

import { Suspense } from 'react';
import { PlayLessonContent } from './_components/PlayLesson';
import { PlaySkeleton } from './_components/PlaySkeleton';

/**
 * Live lesson (patterns.md S6–S8). The screen lives in _components/PlayLesson
 * so /dev/lesson-preview can render the same component from fixtures.
 */
export default function PlayLessonPage() {
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <PlayLessonContent />
    </Suspense>
  );
}
