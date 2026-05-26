import { readFile } from "fs/promises";
import path from "path";
import * as fontkit from "fontkit";
import { PDFDocument, PDFFont, PDFPage, PDFTextField, rgb } from "pdf-lib";

export type Tawi50PdfInput = {
  companyName: string;
  companyTaxId: string;
  companyAddress: string;
  signatoryName: string;
  tutorName: string;
  tutorNationalId: string;
  tutorAddress: string;
  documentNumber: string;
  periodMonth: string;
  issuedAt: string;
  paidDate: string;
  grossAmount: number;
  withholdingTax: number;
};

const THAI_DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const THAI_MONTHS = [
  "",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function numToThai(n: number): string {
  if (n === 0) return "";
  if (n >= 1_000_000) {
    return `${numToThai(Math.floor(n / 1_000_000))}ล้าน${numToThai(n % 1_000_000)}`;
  }

  const str = n.toString();
  let result = "";
  for (let i = 0; i < str.length; i += 1) {
    const digit = Number(str[i]);
    const position = str.length - 1 - i;
    if (digit === 0) continue;

    if (position === 1 && digit === 2) result += "ยี่สิบ";
    else if (position === 1 && digit === 1) result += "สิบ";
    else if (position === 0 && digit === 1 && n % 100 >= 11) result += "เอ็ด";
    else result += THAI_DIGITS[digit] + THAI_PLACES[position];
  }
  return result;
}

function bahtToWords(amount: number): string {
  const intPart = Math.floor(amount);
  const satang = Math.round((amount - intPart) * 100);
  if (intPart === 0 && satang === 0) return "ศูนย์บาทถ้วน";

  const baht = intPart > 0 ? numToThai(intPart) : "ศูนย์";
  return `${baht}บาท${satang === 0 ? "ถ้วน" : `${numToThai(satang)}สตางค์`}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function thaiDateParts(value: string, fallbackToToday = false) {
  const date = parseDate(value) ?? (fallbackToToday ? new Date() : null);
  if (!date) return { day: "", month: "", year: "" };

  return {
    day: String(date.getDate()),
    month: THAI_MONTHS[date.getMonth() + 1] ?? "",
    year: String(date.getFullYear() + 543),
  };
}

function formatThaiNumericDate(value: string): string {
  const date = parseDate(value);
  if (!date) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear() + 543}`;
}

type DrawContext = {
  page: PDFPage;
  pageHeight: number;
  font: PDFFont;
};

function yFromTop(ctx: DrawContext, topFromTop: number, fieldHeight = 0, fontSize = 8) {
  return ctx.pageHeight - topFromTop - fieldHeight + (fieldHeight - fontSize) / 2 + 1.8;
}

function draw(ctx: DrawContext, text: string | number, x: number, y: number, size = 8) {
  ctx.page.drawText(String(text), {
    x,
    y,
    size,
    font: ctx.font,
    color: rgb(0, 0, 0),
  });
}

function drawText(ctx: DrawContext, text: string | number, x: number, top: number, fieldHeight: number, size = 8) {
  draw(ctx, text, x, yFromTop(ctx, top, fieldHeight, size), size);
}

function drawRight(
  ctx: DrawContext,
  text: string | number,
  fieldX: number,
  fieldWidth: number,
  fieldTop: number,
  fieldHeight: number,
  size = 8,
) {
  const rendered = String(text);
  const width = ctx.font.widthOfTextAtSize(rendered, size);
  drawText(ctx, rendered, fieldX + fieldWidth - width - 2, fieldTop, fieldHeight, size);
}

function drawCenter(
  ctx: DrawContext,
  text: string | number,
  fieldX: number,
  fieldWidth: number,
  fieldTop: number,
  fieldHeight: number,
  size = 8,
) {
  const rendered = String(text);
  const width = ctx.font.widthOfTextAtSize(rendered, size);
  drawText(ctx, rendered, fieldX + (fieldWidth - width) / 2, fieldTop, fieldHeight, size);
}

function drawTaxId(ctx: DrawContext, taxId: string, fieldX: number, fieldWidth: number, top: number, fieldHeight: number) {
  const digits = taxId.replace(/\D/g, "").slice(0, 13);
  const groups = [1, 4, 5, 2, 1];
  const groupGap = 4;
  const boxWidth = (fieldWidth - groupGap * (groups.length - 1)) / 13;
  let x = fieldX;
  let digitIndex = 0;

  for (const groupLength of groups) {
    for (let i = 0; i < groupLength; i += 1) {
      const digit = digits[digitIndex] ?? "";
      drawCenter(ctx, digit, x, boxWidth, top, fieldHeight, 8);
      x += boxWidth;
      digitIndex += 1;
    }
    x += groupGap;
  }
}

export async function generateTawi50Pdf(input: Tawi50PdfInput): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), "public", "documents", "tawi50-template.pdf");
  const fontPath = path.join(process.cwd(), "public", "fonts", "Sarabun-Regular.ttf");

  const [templateBytes, fontBytes] = await Promise.all([readFile(templatePath), readFile(fontPath)]);
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  pdfDoc.registerFontkit(fontkit);

  const font = await pdfDoc.embedFont(fontBytes);
  const form = pdfDoc.getForm();
  const page = pdfDoc.getPage(0);
  const ctx: DrawContext = { page, pageHeight: page.getHeight(), font };

  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) {
      try {
        field.setText("");
      } catch {}
    }
  }

  try {
    form.getCheckBox("chk4").check();
  } catch {}
  try {
    form.getCheckBox("chk8").check();
  } catch {}
  try {
    form.removeField(form.getButton("clear data"));
  } catch {}

  form.updateFieldAppearances(font);
  form.flatten({ updateFieldAppearances: false });

  const gross = formatAmount(input.grossAmount);
  const withholdingTax = formatAmount(input.withholdingTax);
  const paymentDate = formatThaiNumericDate(input.paidDate);
  const issued = thaiDateParts(input.issuedAt, true);

  drawCenter(ctx, "1", 519, 40, 45, 16, 7);
  drawText(ctx, input.documentNumber, 521, 61, 16, 6);
  drawCenter(ctx, "1", 77, 62, 226, 15, 8);

  drawTaxId(ctx, input.companyTaxId, 375, 184, 83, 15);
  drawText(ctx, input.companyName, 56, 97, 16, 8);
  drawText(ctx, input.companyAddress, 63, 120, 16, 7);

  drawTaxId(ctx, input.tutorNationalId, 375, 182, 152, 15);
  drawText(ctx, input.tutorName, 55, 171, 14, 8);
  drawText(ctx, input.tutorAddress, 61, 199, 16, 7);

  drawText(ctx, "ค่าบริการ / ค่าจ้างสอน", 98, 628, 17, 8);
  drawCenter(ctx, paymentDate, 327, 76, 629, 14, 7);
  drawRight(ctx, gross, 409, 80, 629, 14, 7);
  drawRight(ctx, withholdingTax, 496, 65, 629, 15, 7);

  drawRight(ctx, gross, 409, 79, 646, 15, 7);
  drawRight(ctx, withholdingTax, 496, 65, 646, 16, 7);
  drawText(ctx, bahtToWords(input.withholdingTax), 187, 665, 19, 8);

  drawCenter(ctx, input.signatoryName, 310, 145, 739, 14, 8);
  drawCenter(ctx, issued.day, 342, 24, 755, 15, 8);
  drawCenter(ctx, issued.month, 364, 65, 755, 17, 8);
  drawCenter(ctx, issued.year, 429, 41, 755, 14, 8);

  return pdfDoc.save();
}
