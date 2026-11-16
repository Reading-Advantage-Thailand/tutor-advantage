import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonShell } from "@/components/app/LessonShell";
import { devRoutesEnabled } from "@/lib/security";
import { getPreparationArticle } from "@/app/(dashboard)/lesson/[id]/prepare/actions";
import { resolveArticleCovers } from "@/app/(dashboard)/lesson/[id]/_lib/server";
import { PresenterPreview, type PreviewParams } from "./PresenterPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Presenter preview (dev) - Tutor Advantage",
  robots: { index: false, follow: false },
};

/**
 * Dev-only harness for the live lesson screens that need a socket session:
 * the lobby (LobbyView) and the presenter (PhaseManager in live mode) with
 * fixture students, plus the teacher-demo end card. Gated like /dev/ui-kit.
 *
 * Query: view=lobby|presenter|endcard · phase=0–18 · state=answering|results|
 * left|offline|rewound|empty|ready|loading|finishing · game=idle|voting|ready|
 * countdown|playing|results · class=<id>&article=<id> loads a real article
 * of one of the tutor's classes (read-only, the rehearsal's own loader).
 */
export default async function PresenterPreviewPage({ searchParams }: { searchParams: Promise<PreviewParams & { class?: string; article?: string }> }) {
  if (!devRoutesEnabled()) notFound();
  const query = await searchParams;
  let article: Record<string, unknown> | null = null;
  if (query.class && query.article) {
    try {
      const raw = (await getPreparationArticle(query.class, query.article)) as Record<string, unknown>;
      article = { ...raw, image_urls: await resolveArticleCovers(raw) };
    } catch {
      article = null;
    }
  }
  return (
    <LessonShell exitHref="/dev/ui-kit" exitLabel="Dev">
      <PresenterPreview article={article} params={{ view: query.view, phase: query.phase, state: query.state, game: query.game }} />
    </LessonShell>
  );
}
