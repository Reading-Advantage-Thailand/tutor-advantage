import { NextRequest, NextResponse } from "next/server"
import { auth } from "./lib/auth"

export async function middleware(req: NextRequest) {
  const session = await auth()

  const adminPaths = ["/admin"]
  const tutorPaths = ["/tutor"]

  // if (adminPaths.some(path => req.nextUrl.pathname.startsWith(path))) {
  //   if (session?.user?.role !== "ADMIN") {
  //     return NextResponse.redirect(new URL("/unauthorized", req.url))
  //   }
  // }

  // if (tutorPaths.some(path => req.nextUrl.pathname.startsWith(path))) {
  //   if (session?.user?.role !== "TUTOR" && session?.user?.role !== "ADMIN") {
  //     return NextResponse.redirect(new URL("/unauthorized", req.url))
  //   }
  // }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/tutor/:path*"],
}
