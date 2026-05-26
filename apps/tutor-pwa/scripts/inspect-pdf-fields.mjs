/**
 * Inspect tawi50-template.pdf AcroForm fields with positions.
 * Run: node scripts/inspect-pdf-fields.mjs
 */
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pdfPath = join(__dirname, "../public/documents/tawi50-template.pdf");
const pdfBytes = readFileSync(pdfPath);
const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

const form = pdfDoc.getForm();
const fields = form.getFields();

const page = pdfDoc.getPage(0);
const { height } = page.getSize();   // 842 pts — PDF y=0 is bottom

console.log(`Total fields: ${fields.length}\n`);

/** Get rect from field dict (works when field IS its own widget) */
function getRect(field) {
  try {
    const r = field.acroField.dict.get(PDFName.of("Rect"));
    if (r instanceof PDFArray) {
      const x1 = r.get(0).asNumber();
      const y1 = r.get(1).asNumber();
      const x2 = r.get(2).asNumber();
      const y2 = r.get(3).asNumber();
      // Convert PDF y (bottom-up) to page y from top
      const fromTop = Math.round(height - y2);
      return { x: Math.round(x1), y: Math.round(fromTop), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
    }
  } catch {}
  return null;
}

// Print all fields sorted by vertical position (top to bottom)
const rows = fields.map(f => {
  const name = f.getName();
  const type = f.constructor.name.replace("PDF", "");
  const rect = getRect(f);
  return { name, type, rect, yFromTop: rect?.y ?? 9999 };
}).sort((a, b) => a.yFromTop - b.yFromTop || a.rect?.x - b.rect?.x);

for (const { name, type, rect } of rows) {
  if (rect) {
    console.log(`  ${name.padEnd(22)} [${type.padEnd(9)}] top=${rect.y.toString().padStart(3)}  x=${rect.x.toString().padStart(3)}  w=${rect.w}  h=${rect.h}`);
  } else {
    console.log(`  ${name.padEnd(22)} [${type.padEnd(9)}] (no rect)`);
  }
}
