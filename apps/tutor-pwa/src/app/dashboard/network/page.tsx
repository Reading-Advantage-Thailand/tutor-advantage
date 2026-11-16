import { cookies } from "next/headers";
import { NetworkView } from "./network-view";
import type { NetworkResponse } from "./network-data";

async function getNetworkData(token: string): Promise<NetworkResponse | null> {
  if (!token) return null;
  try {
    const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
    const res = await fetch(`${baseUrl}/v1/tutors/network`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch network data:", error);
    return null;
  }
}

export default async function NetworkPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  const response = await getNetworkData(token);

  return <NetworkView response={response} />;
}
