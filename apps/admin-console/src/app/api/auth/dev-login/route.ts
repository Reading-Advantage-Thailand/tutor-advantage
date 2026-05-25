import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
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

    const token = jwt.sign(
      { userId: "mock-admin-uuid-0000", role, iss: "admin-console" },
      JWT_SECRET,
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

    response.cookies.set("admin_email", `dev-${role.toLowerCase()}@localhost`, {
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
