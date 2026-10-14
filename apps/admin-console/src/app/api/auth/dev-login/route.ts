import { NextResponse } from "next/server";
import { prisma } from "@tutor-advantage/database";
import { isAdminRole } from "@/lib/routes";
import { devRoutesEnabled, setAdminSessionCookies } from "@/lib/security";

/**
 * Dev-only login: signs an admin-console session for a REAL user that has
 * the requested role (the backend re-reads the user from the DB, so a
 * made-up id only produces 401s). Enabled only when NODE_ENV !== "production"
 * AND ENABLE_DEV_ROUTES === "true".
 *
 * Picks the first active user with the role, preferring the well-known local
 * accounts (admin@example.com / checker@example.com).
 */
const PREFERRED_EMAIL: Record<string, string> = {
  ADMIN: "admin@example.com",
  FINANCE_CHECKER: "checker@example.com",
};

export async function POST(req: Request) {
  if (!devRoutesEnabled()) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  let role: unknown;
  try {
    ({ role } = await req.json());
  } catch {
    role = undefined;
  }
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid role" } }, { status: 400 });
  }

  try {
    const select = { userId: true, email: true, displayName: true, profilePictureUrl: true } as const;
    const user =
      (await prisma.user.findFirst({ where: { email: PREFERRED_EMAIL[role], role, isActive: true }, select })) ??
      (await prisma.user.findFirst({ where: { role, isActive: true }, orderBy: { createdAt: "asc" }, select }));

    if (!user) {
      return NextResponse.json(
        { error: { code: "DEV_USER_NOT_FOUND", message: `No active ${role} user exists. Seed one first.` } },
        { status: 409 },
      );
    }

    const response = NextResponse.json({ success: true, role, userId: user.userId });
    await setAdminSessionCookies(response, {
      userId: user.userId,
      role,
      email: user.email,
      name: user.displayName || user.email,
      picture: user.profilePictureUrl,
    });
    return response;
  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Dev login failed" } }, { status: 500 });
  }
}
