import { LEARNING_URL } from "@/lib/service-urls";
import TutorLobbyClient from "./LobbyClient";

export default async function TutorLobbyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ articleId?: string; cycleId?: string; bookId?: string; demo?: string }>;
}) {
  const { id: classId } = await params;
  const { articleId = "", cycleId, bookId, demo } = await searchParams;

  return (
    <TutorLobbyClient
      classId={classId}
      articleId={articleId}
      classBookCycleId={cycleId}
      bookId={bookId}
      socketUrl={LEARNING_URL}
      demo={demo === "1" || demo === "true"}
    />
  );
}
