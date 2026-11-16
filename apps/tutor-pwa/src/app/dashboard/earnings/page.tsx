import { cookies } from "next/headers";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { EarningsView, type TutorProfile } from "./earnings-view";
import type { EarningsResponse } from "./lib/earnings";

async function getEarningsHistoryData(token: string): Promise<EarningsResponse | null> {
  if (!token) return null;

  const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
  const res = await fetch(`${baseUrl}/v1/tutors/earnings/history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function EarningsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  // The session (identity /users/me) is memoised per request: the layout already loaded it.
  const [response, session] = await Promise.all([getEarningsHistoryData(token), getActiveTutorSession()]);
  const user = (session?.user ?? null) as TutorProfile | null;

  return <EarningsView response={response} user={user} />;
}
