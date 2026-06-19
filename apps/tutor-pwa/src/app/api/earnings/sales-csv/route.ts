import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const FINANCE_API_BASE_URL = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodMonth = searchParams.get("periodMonth");
  
  const queryUrl = new URL(`${FINANCE_API_BASE_URL}/v1/tutors/earnings/sales-csv`);
  if (periodMonth) {
    queryUrl.searchParams.set("periodMonth", periodMonth);
  }

  try {
    const response = await fetch(queryUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(`Error from finance API: ${errorText}`, { status: response.status });
    }

    const csvData = await response.arrayBuffer();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales-report-${periodMonth || "all"}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error proxying sales CSV:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
