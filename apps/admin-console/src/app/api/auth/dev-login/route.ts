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

    return NextResponse.json({ token, role });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate dev token" },
      { status: 500 },
    );
  }
}
