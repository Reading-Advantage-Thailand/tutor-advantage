import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";

export async function POST(req: Request) {
  try {
    const { role } = await req.json();

    if (role !== "ADMIN" && role !== "FINANCE_CHECKER") {
      return NextResponse.json({ error: "Invalid mock role" }, { status: 400 });
    }

    const token = jwt.sign(
      {
        userId: "mock-admin-uuid-0000",
        role: role,
      },
      JWT_SECRET,
      { expiresIn: "12h" },
    );

    const response = NextResponse.json({ token, role });
    
    // Set cookies for middleware
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12, // 12 hours
      path: "/",
    });
    
    response.cookies.set("admin_role", role, {
      httpOnly: false, // Allow client to read role if needed
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json(
      { error: "Failed to generate dev token" },
      { status: 500 },
    );
  }
}
