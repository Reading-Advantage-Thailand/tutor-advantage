import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  
  // Clear the session cookie
  cookieStore.set("tutor_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0), // Set to epoch to delete it
  });

  // Redirect to home page
  return NextResponse.redirect(new URL("/", request.url));
}
