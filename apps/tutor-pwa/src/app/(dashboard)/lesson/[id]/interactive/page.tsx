import { LEARNING_URL } from "@/lib/service-urls";
import TutorLobbyClient from "./LobbyClient";

export default async function TutorLobbyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ articleId?: string }>;
}) {
  const { id: classId } = await params;
  const { articleId = "" } = await searchParams;

  return (
    <TutorLobbyClient
      classId={classId}
      articleId={articleId}
      socketUrl={LEARNING_URL}
    />
  );
}
