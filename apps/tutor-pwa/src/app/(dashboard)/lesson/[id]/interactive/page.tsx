import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import TutorLobbyClient from "./LobbyClient";

// Student-invite link for the lobby (same source as the class detail page).
async function getReferralLink(classId: string): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tutor_session")?.value;
    if (!token) return null;
    const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.class?.referralLink ?? null;
  } catch {
    return null;
  }
}

export default async function TutorLobbyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ articleId?: string; cycleId?: string; bookId?: string; demo?: string }>;
}) {
  const { id: classId } = await params;
  const { articleId = "", cycleId, bookId, demo } = await searchParams;
  const isDemo = demo === "1" || demo === "true";

  // Demo walkthroughs have no real class to invite students into.
  const referralLink = isDemo ? null : await getReferralLink(classId);

  return (
    <TutorLobbyClient
      classId={classId}
      articleId={articleId}
      classBookCycleId={cycleId}
      bookId={bookId}
      socketUrl={LEARNING_URL}
      demo={isDemo}
      referralLink={referralLink}
    />
  );
}
