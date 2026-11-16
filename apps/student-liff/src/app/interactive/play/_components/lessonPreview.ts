"use client";

import { createContext, useContext } from "react";
import { useLessonSocket } from "@/hooks/useLessonSocket";
import { useLiff, type LiffContextType } from "@/components/providers/LiffProvider";

/** Everything the live lesson reads from its socket hook. */
export type LessonSocketState = ReturnType<typeof useLessonSocket>;

/**
 * Dev-only seam for /dev/lesson-preview: the real live-lesson screen rendered
 * from a fixture instead of LIFF and a socket. Nothing in production provides
 * this context, so the page calls useLiff() and useLessonSocket() with exactly
 * the same arguments as before and uses their results unchanged.
 */
export interface LessonPreviewValue {
  socket: LessonSocketState;
  liff: LiffContextType;
}

export const LessonPreviewContext = createContext<LessonPreviewValue | null>(null);

/** useLiff(), or the preview's profile inside /dev/lesson-preview. */
export function useLessonLiff(): LiffContextType {
  const preview = useContext(LessonPreviewContext);
  const live = useLiff();
  return preview?.liff ?? live;
}

/**
 * useLessonSocket(), or the preview fixture inside /dev/lesson-preview (where
 * the hook gets no class id, so it never opens a socket).
 */
export function useLessonSession(
  classId: string | undefined,
  studentId: string,
  name: string,
  pictureUrl?: string,
): LessonSocketState {
  const preview = useContext(LessonPreviewContext);
  const live = useLessonSocket(preview ? undefined : classId, studentId, name, pictureUrl);
  return preview?.socket ?? live;
}
