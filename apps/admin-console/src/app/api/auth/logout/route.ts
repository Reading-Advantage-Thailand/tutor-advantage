import { NextResponse } from "next/server";
import { clearAdminCookies } from "@/lib/security";

/** Clears EVERY admin cookie (token, role and the display cookies with PII). */
export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAdminCookies(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
