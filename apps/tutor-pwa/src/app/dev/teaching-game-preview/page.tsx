import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { TeachingGamePreview } from "./TeachingGamePreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teaching game preview (dev) - Tutor Advantage",
  robots: { index: false, follow: false },
};

/**
 * Dev-only QA page: mounts a teaching game through the real registry inside a
 * mock of the presenter's game-phase layout. Gated like the other dev routes
 * (NODE_ENV !== production and ENABLE_DEV_ROUTES=true).
 *
 *   /dev/teaching-game-preview?game=castle-defense&mode=teacher|tutorial&fullscreen=1&content=real|none
 */
export default async function TeachingGamePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; mode?: string; fullscreen?: string; content?: string }>;
}) {
  if (!devRoutesEnabled()) notFound();
  const { game, mode, fullscreen, content } = await searchParams;
  return (
    <TeachingGamePreview
      gameId={game || "castle-defense"}
      mode={mode === "tutorial" ? "tutorial" : "teacher"}
      fullscreen={fullscreen === "1"}
      content={content}
    />
  );
}
