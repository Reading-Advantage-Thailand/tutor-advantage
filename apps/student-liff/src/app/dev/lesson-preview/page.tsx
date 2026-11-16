import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { LessonPreview } from "./LessonPreview";

export const metadata: Metadata = {
  title: "Lesson preview (dev) - Tutor Advantage",
  robots: "noindex, nofollow",
};

/**
 * Dev-only harness: the real live-lesson screen (S6–S8) rendered from fixtures
 * for every phase and state, without a tutor session or a socket. 404 unless
 * devRoutesEnabled() (NODE_ENV !== "production" and ENABLE_DEV_ROUTES=true).
 */
export default function LessonPreviewPage() {
  if (!devRoutesEnabled()) notFound();
  return <LessonPreview />;
}
