/**
 * GET /api/documents/tawi50?documentNumber=<number>
 *
 * Generates a Thai withholding tax certificate (ใบ 50 ทวิ) as a PDF file.
 *
 * Query params:
 *   documentNumber  — payout document identifier
 *   gross           — gross income before WHT in THB (integer)
 *   wht             — withholding tax amount in THB (integer)
 *   net             — net payout after WHT in THB (integer)
 *   period          — billing period month (e.g. "2025-05")
 *   issuedAt        — ISO date of payout document approval
 *   paidDate        — ISO date of money transfer (may be empty)
 *
 * Authentication: reads tutor_session cookie, fetches user profile from identity-service.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateTawi50Pdf } from "@/lib/tawi50Pdf";
import { getMissingTawi50Fields } from "@/lib/tawi50Requirements";
import { IDENTITY_URL } from "@/lib/service-urls";

export const dynamic = "force-dynamic";

async function getUserProfile(token: string) {
  const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user ?? null;
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value ?? "";

  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await getUserProfile(token);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // ── Query params ──────────────────────────────────────────────────────
  const { searchParams } = req.nextUrl;
  const documentNumber = searchParams.get("documentNumber") ?? "";
  const grossStr       = searchParams.get("gross") ?? "0";
  const whtStr         = searchParams.get("wht") ?? "0";
  const period         = searchParams.get("period") ?? "";
  const issuedAtStr    = searchParams.get("issuedAt") ?? "";
  const paidDateStr    = searchParams.get("paidDate") ?? "";

  const grossAmount    = Math.max(0, parseInt(grossStr, 10) || 0);
  const withholdingTax = Math.max(0, parseInt(whtStr, 10) || 0);

  if (!documentNumber || !period) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "documentNumber and period are required" },
      { status: 400 },
    );
  }

  // ── Company info from env ─────────────────────────────────────────────
  const companyName    = process.env.TAWI50_COMPANY_NAME    ?? "บริษัท รีดิ้งแอดแวนเทจ(ไทยแลนด์) จำกัด";
  const companyTaxId   = process.env.TAWI50_COMPANY_TAX_ID  ?? "0405567001165";
  const companyAddress = process.env.TAWI50_COMPANY_ADDRESS ?? "322/132 หมู่ที่ 20 ตำบลบ้านเป็ด อำเภอเมืองขอนแก่น จ.ขอนแก่น 40000";
  const signatoryName  = process.env.TAWI50_SIGNATORY_NAME  ?? "พิกุล ภูกะฐิน";

  // ── Tutor info from profile ───────────────────────────────────────────
  const settings       = (user.settings as Record<string, unknown>) ?? {};
  // taxName = legal name as on ID card for tax purposes; fallback to displayName
  const tutorName      = (settings.taxName as string) || (user.displayName as string) || "";
  const tutorNationalId = (settings.nationalId as string) ?? "";
  const tutorAddress   = (settings.address as string) ?? "";
  const missingFields = getMissingTawi50Fields(settings);

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: "MISSING_TAWI50_FIELDS",
        message: "Please complete account and finance information before downloading Form 50 Tawi",
        missingFields,
      },
      { status: 400 },
    );
  }

  // ── Generate PDF ──────────────────────────────────────────────────────
  try {
    const pdfBytes = await generateTawi50Pdf({
      companyName,
      companyTaxId,
      companyAddress,
      signatoryName,
      tutorName,
      tutorNationalId,
      tutorAddress,
      documentNumber,
      periodMonth: period,
      issuedAt: issuedAtStr || new Date().toISOString(),
      paidDate: paidDateStr,
      grossAmount,
      withholdingTax,
    });
    const filename  = `tawi50-${documentNumber}.pdf`;
    const responseBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(responseBuffer).set(pdfBytes);
    const body = new Blob([responseBuffer], { type: "application/pdf" });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("[tawi50] PDF generation error:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Could not generate PDF" },
      { status: 500 },
    );
  }
}
