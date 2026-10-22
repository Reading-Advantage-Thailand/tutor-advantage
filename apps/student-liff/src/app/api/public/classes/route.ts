import { NextResponse } from "next/server";
import { getPublicCourses } from "@/lib/publicCourseServer";

export async function GET() {
  try {
    return NextResponse.json({ classes: await getPublicCourses() });
  } catch {
    return NextResponse.json({ error: "CATALOG_UNAVAILABLE" }, { status: 503 });
  }
}
