import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { devRoutesEnabled, getJwtSecret } from "@/lib/security";

const DEV_IDENTITIES = {
  ADMIN: {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "dev-admin@localhost",
  },
  FINANCE_CHECKER: {
    userId: "00000000-0000-4000-8000-000000000002",
    email: "dev-finance-checker@localhost",
  },
} as const;

export async function POST(req: Request) {
  if (!devRoutesEnabled()) {
    return NextResponse.json(
      { error: "Endpoint disabled in production" },
      { status: 403 }
    );
  }

  try {
    const { role } = await req.json();

    if (role !== "ADMIN" && role !== "FINANCE_CHECKER") {
      return NextResponse.json({ error: "Invalid mock role" }, { status: 400 });
    }

    const identity = DEV_IDENTITIES[role as keyof typeof DEV_IDENTITIES];
    const token = jwt.sign(
      { userId: identity.userId, email: identity.email, role, iss: "admin-console" },
      getJwtSecret(),
      { expiresIn: "12h" }
    );

    // Token goes only into httpOnly cookie — not returned in response body
    const response = NextResponse.json({ success: true, role });

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    response.cookies.set("admin_role", role, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    response.cookies.set("admin_email", identity.email, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json(
      { error: "Failed to generate dev token" },
      { status: 500 }
    );
  }
}
