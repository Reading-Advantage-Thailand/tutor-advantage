import { cookies } from "next/headers";
import { jwtVerify } from "jose/jwt/verify";
import { IDENTITY_URL } from "@/lib/service-urls";
import { getJwtSecret } from "@/lib/security";

const jwtSecret = () => new TextEncoder().encode(getJwtSecret());

export type ActiveTutorSession = {
  token: string;
  user: {
    userId: string;
    role: string;
    isActive?: boolean;
    userConsents?: Array<{ consentType: string; status: string }>;
    [key: string]: unknown;
  };
};

export async function getActiveTutorSession(): Promise<ActiveTutorSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (payload.role !== "TUTOR") return null;
  } catch {
    return null;
  }

  try {
    const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { user?: ActiveTutorSession["user"] };
    const user = data.user;

    if (!user) return null;
    if (user.role !== "TUTOR") return null;
    if (user.isActive === false) return null;

    return { token, user };
  } catch {
    return null;
  }
}
