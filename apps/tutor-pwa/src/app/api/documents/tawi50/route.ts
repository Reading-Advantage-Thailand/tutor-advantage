/**
 * GET /api/documents/tawi50?payoutDocumentId=<id>
 *
 * Generates a Thai withholding tax certificate from the immutable, approved
 * payout document. Amounts and dates are never accepted from the URL.
 */

import { prisma } from "@tutor-advantage/database";
import { NextRequest, NextResponse } from "next/server";
import { generateTawi50Pdf } from "@/lib/tawi50Pdf";
import { getMissingTawi50Fields } from "@/lib/tawi50Requirements";
import { getActiveTutorSession } from "@/lib/tutor-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getActiveTutorSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const payoutDocumentId = req.nextUrl.searchParams.get("payoutDocumentId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payoutDocumentId)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "payoutDocumentId is required" },
      { status: 400 },
    );
  }

  const payoutDocument = await prisma.payoutDocument.findUnique({
    where: { payoutDocumentId },
    include: {
      payoutLine: {
        include: { settlementRun: true },
      },
    },
  });

  // Do not distinguish a missing document from somebody else's document.
  if (
    !payoutDocument ||
    payoutDocument.tutorUserId !== session.user.userId ||
    payoutDocument.payoutLine.settlementRun.status !== "APPROVED"
  ) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { user } = session;
  const settings = (user.settings as Record<string, unknown>) ?? {};
  const tutorName = (settings.taxName as string) || (user.displayName as string) || "";
  const tutorNationalId = (settings.nationalId as string) ?? "";
  const tutorAddress = (settings.address as string) ?? "";
  const missingFields = getMissingTawi50Fields(settings);

  if (user.verificationStatus !== "VERIFIED") {
    return NextResponse.json(
      { error: "UNVERIFIED", message: "You must be verified by an admin to download Form 50 Tawi" },
      { status: 403 },
    );
  }

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

  const companyName = process.env.TAWI50_COMPANY_NAME ?? "บริษัท รีดิ้งแอดแวนเทจ(ไทยแลนด์) จำกัด";
  const companyTaxId = process.env.TAWI50_COMPANY_TAX_ID ?? "0405567001165";
  const companyAddress = process.env.TAWI50_COMPANY_ADDRESS ?? "322/132 หมู่ที่ 20 ตำบลบ้านเป็ด อำเภอเมืองขอนแก่น จ.ขอนแก่น 40000";
  const signatoryName = process.env.TAWI50_SIGNATORY_NAME ?? "พิกุล ภูกะฐิน";
  const periodMonth = payoutDocument.payoutLine.settlementRun.periodMonth;
  const issuedAt = payoutDocument.issuedAt.toISOString();
  const paidDate = payoutDocument.transferredAt?.toISOString() ?? "";
  const grossAmount = Number(payoutDocument.grossAmountMinor) / 100;
  const withholdingTax = Number(payoutDocument.withholdingTaxMinor) / 100;

  try {
    const pdfBytes = await generateTawi50Pdf({
      companyName,
      companyTaxId,
      companyAddress,
      signatoryName,
      tutorName,
      tutorNationalId,
      tutorAddress,
      documentNumber: payoutDocument.documentNumber,
      periodMonth,
      issuedAt,
      paidDate,
      grossAmount,
      withholdingTax,
    });

    const responseBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(responseBuffer).set(pdfBytes);
    const body = new Blob([responseBuffer], { type: "application/pdf" });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tawi50-${payoutDocument.documentNumber}.pdf"`,
        "Content-Length": pdfBytes.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[tawi50] PDF generation error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Could not generate PDF" },
      { status: 500 },
    );
  }
}
