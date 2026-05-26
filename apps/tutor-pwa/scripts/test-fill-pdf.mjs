/**
 * Fill tawi50-template.pdf with Sarabun font, drawn directly on the page.
 *
 * Strategy:
 *  1. Mark all text fields dirty with empty string  → updateFieldAppearances()
 *     generates transparent empty appearances (no white box artifacts).
 *  2. Check the two required checkboxes.
 *  3. form.flatten({ updateFieldAppearances:false })
 *     → bakes empty field areas + checked-checkbox appearances into the page,
 *       removes interactive layer (incl. Clear Data button).
 *  4. page.drawText() for EVERYTHING (Thai + ASCII) on top of the flattened layer.
 *     This avoids appearance-generation artefacts and works in any PDF viewer.
 *  5. Tax ID digit boxes: draw one digit per box at precisely computed centres.
 *
 * Run:  node scripts/test-fill-pdf.mjs
 * Out:  scripts/test-output.pdf
 */
import { PDFDocument, PDFName, rgb } from "pdf-lib";
import * as fontkit from "fontkit";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfPath     = join(__dirname, "../public/documents/tawi50-template.pdf");
const sarabunPath = join(__dirname, "../public/fonts/Sarabun-Regular.ttf");
const outPath     = join(__dirname, "test-output.pdf");

const pdfDoc = await PDFDocument.load(readFileSync(pdfPath), { ignoreEncryption: true });
pdfDoc.registerFontkit(fontkit);
const font = await pdfDoc.embedFont(readFileSync(sarabunPath));
const form = pdfDoc.getForm();
const page = pdfDoc.getPage(0);
const H    = page.getHeight();   // 842 pts

// ── helpers ───────────────────────────────────────────────────

/** Convert "top from page-top" to pdf-lib's y-from-bottom, centered in the field. */
const py = (topFromTop, fieldH = 0, size = 8) =>
  H - topFromTop - fieldH + (fieldH - size) / 2 + 1.8;

/** Draw a single string. */
const draw = (text, x, y, size = 8) =>
  page.drawText(String(text), { x, y, size, font, color: rgb(0, 0, 0) });

/** Draw text right-aligned inside a field box. */
function drawRight(text, fieldX, fieldW, fieldTop, fieldH, size = 8) {
  const w = font.widthOfTextAtSize(String(text), size);
  draw(text, fieldX + fieldW - w - 2, py(fieldTop, fieldH, size), size);
}

/** Draw text centred horizontally in a field box. */
function drawCenter(text, fieldX, fieldW, fieldTop, fieldH, size = 8) {
  const w = font.widthOfTextAtSize(String(text), size);
  draw(text, fieldX + (fieldW - w) / 2, py(fieldTop, fieldH, size), size);
}

/** Draw each digit of a 13-digit tax ID into official 1-4-5-2-1 grouped boxes. */
function drawDigits(taxId, fieldX, fieldW, topFromTop, fieldH, size = 8) {
  const digits  = taxId.replace(/\D/g, "").slice(0, 13);
  const groups  = [1, 4, 5, 2, 1];
  const gap     = 4;
  const boxW    = (fieldW - gap * (groups.length - 1)) / 13;
  let x         = fieldX;
  let digit     = 0;
  for (const group of groups) {
    for (let i = 0; i < group; i++) {
      drawCenter(digits[digit] ?? "", x, boxW, topFromTop, fieldH, size);
      x += boxW;
      digit += 1;
    }
    x += gap;
  }
}

// ── sample data ───────────────────────────────────────────────
const companyTaxId   = "0405567001165";
const companyName    = "บริษัท รีดิ้งแอดแวนเทจ(ไทยแลนด์) จำกัด";
const companyAddress = "322/132 หมู่ที่ 20 ต.บ้านเป็ด อ.เมืองขอนแก่น จ.ขอนแก่น 40000";
const signatoryName  = "พิกุล ภูกะฐิน";

const tutorTaxId     = "0000000000000";
const tutorName      = "นายทดสอบ ทดสอบ";
const tutorAddress   = "00 หมู่ 0 ต.ทดสอบ อ.ทดสอบ จ.ทดสอบ 00000";

const grossAmount    = 23000;
const whtAmount      = 690;
const grossStr       = "23,000.00";
const whtStr         = "690.00";

// ── Step 1 — blank-out all text fields (makes them dirty) ────
for (const f of form.getFields()) {
  if (f.constructor.name === "PDFTextField") {
    try { f.setText(""); } catch {}
  }
}

// ── Step 2 — check checkboxes ─────────────────────────────────
try { form.getCheckBox("chk4").check(); } catch {}   // ✓ ภ.ง.ด.3
try { form.getCheckBox("chk8").check(); } catch {}   // ✓ หัก ณ ที่จ่าย

// ── Step 3 — generate empty appearances + remove button ───────
form.removeField(form.getButton("clear data"));
form.updateFieldAppearances(font);
form.flatten({ updateFieldAppearances: false });

// ── Step 4 — draw everything on the page (on top of flat layer)

// Header
drawCenter("1",                        519, 40,  45, 16, 7);   // book_no
draw("50TAWI-20260525-TEST001",         521, py(61, 16, 6), 6); // run_no
drawCenter("1",                         77, 62, 226, 15, 8);   // item/ลำดับที่

// Payer — tax ID digit boxes (id1: x=375 w=184 top=83 h=15)
drawDigits(companyTaxId, 375, 184, 83,  15, 8);
// Payer name & address
draw(companyName,    56, py(97,  16, 8), 8);   // name1
draw(companyAddress, 63, py(120, 16, 7), 7);   // add1

// Payee — tax ID digit boxes (id1_2: x=375 w=182 top=152 h=15)
drawDigits(tutorTaxId, 375, 182, 152, 15, 8);
// Payee name & address
draw(tutorName,    55, py(171, 14, 8), 8);   // name2
draw(tutorAddress, 61, py(199, 16, 7), 7);   // add2

// Row 6 (อื่นๆ ระบุ ค่าบริการ/ค่าจ้างสอน)
//   spec3:      x=96  w=229 top=628 h=17
//   date14.1:   x=327 w=76  top=629 h=14
//   pay1.13.1:  x=409 w=80  top=629 h=14
//   tax1.13.1:  x=496 w=65  top=629 h=15
draw("ค่าบริการ / ค่าจ้างสอน", 98,  py(628, 17, 8), 8);
drawCenter("31/03/2568",        327, 76, 629, 14, 7);
drawRight(grossStr, 409, 80, 629, 14, 7);
drawRight(whtStr,   496, 65, 629, 15, 7);

// Totals row (pay1.14: x=409 w=79 top=646 h=15; tax1.14: x=496 w=65 top=646 h=16)
drawRight(grossStr, 409, 79, 646, 15, 7);
drawRight(whtStr,   496, 65, 646, 16, 7);

// WHT in words (total: x=185 w=373 top=665 h=19)
draw("หกร้อยเก้าสิบบาทถ้วน", 187, py(665, 19, 8), 8);

// Signature date (date_pay: x=342 w=24 top=755 h=15; month_pay: x=364 w=65; year_pay: x=429 w=41)
drawCenter("31",      342, 24, 755, 15, 8);
drawCenter("มีนาคม", 364, 65, 755, 17, 8);
drawCenter("2568",    429, 41, 755, 14, 8);

// Signatory name — on the "ลงชื่อ" dotted line
// Signature block is right-half of form; "ลงชื่อ" static text ends ~x=310; dotted area ~x=310–400
// Date fields (date_pay) are at top=755; signature LINE is ~13 pts above the date inputs
drawCenter(signatoryName, 310, 145, 739, 14, 8);

// ── Step 5 — save ─────────────────────────────────────────────
writeFileSync(outPath, await pdfDoc.save());
console.log("✅  Written:", outPath);
