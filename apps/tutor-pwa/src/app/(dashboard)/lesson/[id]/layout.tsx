import { LessonShell } from "@/components/app/LessonShell";

/**
 * Focused full-screen shell for every /lesson/[id]/* page (hub, select,
 * prepare, rehearsal, live presenter): no sidebar/tab bar, slim exit bar,
 * viewport-height stage. Auth is enforced by middleware (/lesson/:path*).
 */
export default async function LessonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LessonShell exitHref={`/dashboard/classes/${encodeURIComponent(id)}`}>{children}</LessonShell>;
}
