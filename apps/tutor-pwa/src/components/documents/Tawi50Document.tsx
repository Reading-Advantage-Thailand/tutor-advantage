/**
 * Tawi50Document — Official Thai Withholding Tax Certificate
 * หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
 *
 * Matches the official Revenue Department form layout.
 * Rendered server-side via @react-pdf/renderer renderToBuffer().
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import path from "path";

// ── Font ───────────────────────────────────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(FONTS_DIR, "Sarabun-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS_DIR, "Sarabun-Bold.ttf"),    fontWeight: "bold"   },
  ],
});
// Prevent react-pdf from breaking Thai combining characters at word boundaries.
Font.registerHyphenationCallback((word) => [word]);

// ── Types ──────────────────────────────────────────────────────────────────
export type Tawi50Props = {
  companyName:    string;
  companyTaxId:   string;
  companyAddress: string;
  signatoryName:  string;
  tutorName:      string;
  tutorNationalId: string;
  tutorAddress:   string;
  documentNumber: string;
  periodMonth:    string; // "2025-05"
  issuedDate:     string; // formatted Thai date for signature
  paymentDate:    string; // formatted Thai date of transfer
  grossAmount:    number; // THB
  withholdingTax: number; // THB
  netPayout:      number; // THB
};

// ── Helpers ────────────────────────────────────────────────────────────────
const THAI_DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function numToThai(n: number): string {
  if (n === 0) return "";
  if (n >= 1_000_000) {
    return numToThai(Math.floor(n / 1_000_000)) + "ล้าน" + numToThai(n % 1_000_000);
  }
  const str = n.toString();
  const len = str.length;
  let result = "";
  for (let i = 0; i < len; i++) {
    const d = parseInt(str[i]);
    const pos = len - 1 - i;
    if (d === 0) continue;
    if (pos === 1 && d === 2) result += "ยี่สิบ";
    else if (pos === 1 && d === 1) result += "สิบ";
    else if (pos === 0 && d === 1 && n % 100 >= 11) result += "เอ็ด";
    else result += THAI_DIGITS[d] + THAI_PLACES[pos];
  }
  return result;
}

function bahtToWords(amount: number): string {
  const intPart  = Math.floor(amount);
  const satang   = Math.round((amount - intPart) * 100);
  if (intPart === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  let result = (intPart > 0 ? numToThai(intPart) : "ศูนย์") + "บาท";
  result += satang === 0 ? "ถ้วน" : numToThai(satang) + "สตางค์";
  return result;
}

function formatAmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thaiPeriodLabel(periodMonth: string): string {
  try {
    const [year, month] = periodMonth.split("-").map(Number);
    const m = ["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
               "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"][month] ?? "";
    return `${m} ${year + 543}`;
  } catch { return periodMonth; }
}

// ── Styles ─────────────────────────────────────────────────────────────────
const F  = 7.2;   // base font size
const FB = 7.6;   // bold/header font size

const s = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: F,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 22,
    color: "#000",
  },

  // ── Header ──
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  copyBox: {
    borderWidth: 0.5, borderColor: "#000",
    paddingHorizontal: 6, paddingVertical: 3,
    alignItems: "center",
  },
  copyLabel: { fontSize: F - 0.5, textAlign: "center" },
  copyNote: { fontSize: F - 1.5, color: "#555", textAlign: "center", maxWidth: 100 },
  docNumBox: { alignItems: "flex-end", justifyContent: "flex-end" },
  docNumRow: { flexDirection: "row", alignItems: "center", marginBottom: 1 },
  docNumLabel: { fontSize: F, width: 30 },
  docNumLine: { borderBottomWidth: 0.5, borderBottomColor: "#000", width: 90, height: 12 },

  // ── Title ──
  titleBox: { alignItems: "center", marginBottom: 4 },
  titleMain: { fontSize: 12, fontWeight: "bold" },
  titleSub: { fontSize: F + 0.5, marginTop: 1 },

  // ── Section label ──
  sectionLabel: { fontSize: FB, fontWeight: "bold", marginBottom: 3 },

  // ── Info rows ──
  infoRow: { flexDirection: "row", marginBottom: 3, alignItems: "flex-start" },
  infoKey: { width: 14, fontWeight: "bold", fontSize: F },
  infoTag: { width: 42, fontSize: F, fontWeight: "bold" },
  infoVal: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#000", paddingBottom: 1, minHeight: 11 },
  infoValNote: { fontSize: F - 1, color: "#555", marginTop: 1 },

  // ── Digit boxes ──
  digitRow: { flexDirection: "row", alignItems: "center" },
  digitBox: {
    width: 13, height: 13,
    borderWidth: 0.5, borderColor: "#000",
    alignItems: "center", justifyContent: "center",
    marginRight: 1,
  },
  digitSep: { width: 4 }, // spacer between groups
  digitText: { fontSize: F - 0.5, fontWeight: "bold" },
  digitLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  digitLabelText: { fontSize: F - 0.5, marginRight: 4 },

  // ── Checkbox ──
  cbRow: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  cbBox: { width: 9, height: 9, borderWidth: 0.5, borderColor: "#000", alignItems: "center", justifyContent: "center", marginRight: 2 },
  cbMark: { fontSize: 7, fontWeight: "bold", lineHeight: 1 },
  cbLabel: { fontSize: F - 0.5 },

  // ── Divider ──
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#999", marginVertical: 4 },
  thickDivider: { borderBottomWidth: 1, borderBottomColor: "#000", marginVertical: 3 },

  // ── Form type row ──
  formTypeRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 },
  formTypeLeft: { flexDirection: "row", alignItems: "center", width: 55, marginBottom: 2 },
  formTypeNote: { fontSize: F - 1.5, color: "#666", width: 80 },

  // ── Income table ──
  table: { borderWidth: 0.5, borderColor: "#000", marginTop: 3 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#e0e7ff",
    borderBottomWidth: 0.5, borderBottomColor: "#000",
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.3, borderBottomColor: "#aaa" },
  tableRowFilled: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#000", backgroundColor: "#fafbff" },
  tableRowTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#000", backgroundColor: "#e8edff" },

  // Table columns
  colType: { flex: 1, paddingHorizontal: 3, paddingVertical: 2, borderRightWidth: 0.5, borderRightColor: "#000" },
  colDate: { width: 52, paddingHorizontal: 2, paddingVertical: 2, textAlign: "center", borderRightWidth: 0.5, borderRightColor: "#000" },
  colAmt:  { width: 60, paddingHorizontal: 3, paddingVertical: 2, textAlign: "right",  borderRightWidth: 0.5, borderRightColor: "#000" },
  colTax:  { width: 52, paddingHorizontal: 3, paddingVertical: 2, textAlign: "right" },

  tableHeaderText: { fontSize: FB - 0.5, fontWeight: "bold", textAlign: "center" },
  cellText: { fontSize: F },
  cellTextBold: { fontSize: F, fontWeight: "bold" },
  cellSub: { fontSize: F - 1.5, color: "#555", marginTop: 0.5 },

  // ── WHT in words ──
  whtWordsRow: { flexDirection: "row", borderWidth: 0.5, borderColor: "#000", borderTopWidth: 0, alignItems: "center" },
  whtWordsLabel: { width: 130, borderRightWidth: 0.5, borderRightColor: "#000", paddingHorizontal: 3, paddingVertical: 3 },
  whtWordsValue: { flex: 1, paddingHorizontal: 4, paddingVertical: 3, fontWeight: "bold", fontSize: FB },

  // ── Fund contributions ──
  fundRow: {
    flexDirection: "row",
    borderWidth: 0.5, borderColor: "#000", borderTopWidth: 0,
    paddingVertical: 3, paddingHorizontal: 3,
    alignItems: "center",
  },
  fundLabel: { fontSize: F - 0.5, marginRight: 6 },
  fundField: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#aaa", marginHorizontal: 4, height: 10, fontSize: F },

  // ── Payment type ──
  payTypeRow: {
    borderWidth: 0.5, borderColor: "#000", borderTopWidth: 0,
    paddingVertical: 4, paddingHorizontal: 6,
  },
  payTypeLabel: { fontSize: FB, fontWeight: "bold", marginBottom: 4 },
  payTypeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 4 },

  // ── Caution ──
  cautionBox: {
    borderWidth: 0.5, borderColor: "#000", borderTopWidth: 0,
    padding: 4, backgroundColor: "#fffbe6",
  },
  cautionText: { fontSize: F - 1, color: "#333" },

  // ── Signature ──
  sigRow: {
    flexDirection: "row",
    borderWidth: 0.5, borderColor: "#000", borderTopWidth: 0,
    paddingVertical: 6, paddingHorizontal: 8,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sigBlock: { width: 180, alignItems: "center" },
  sigLine: { borderTopWidth: 0.5, borderTopColor: "#000", width: "100%", marginBottom: 3, marginTop: 20 },
  sigName: { fontSize: F, fontWeight: "bold", textAlign: "center" },
  sigRole: { fontSize: F - 0.5, color: "#444", textAlign: "center", marginTop: 1 },
  sigDateRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  sigDateLabel: { fontSize: F, marginRight: 2 },
  sigDateLine: { borderBottomWidth: 0.5, borderBottomColor: "#000", width: 110, height: 11, fontSize: F, paddingHorizontal: 2 },

  // ── Footer note ──
  footerNote: { marginTop: 4, paddingHorizontal: 2 },
  footerNoteText: { fontSize: F - 1.5, color: "#666" },
});

// ── Sub-components ─────────────────────────────────────────────────────────

/** Renders 13 digit boxes for a Thai tax ID. Groups: 1-4-5-2-1 */
function DigitBoxRow({ value }: { value: string }) {
  const raw    = value.replace(/\D/g, "").slice(0, 13).padEnd(13, " ");
  const groups = [raw.slice(0,1), raw.slice(1,5), raw.slice(5,10), raw.slice(10,12), raw.slice(12,13)];
  return (
    <View style={s.digitRow}>
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <View style={s.digitSep} />}
          {group.split("").map((ch, di) => (
            <View key={di} style={s.digitBox}>
              <Text style={s.digitText}>{ch.trim()}</Text>
            </View>
          ))}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Renders a single checkbox */
function CB({ checked = false, label }: { checked?: boolean; label: string }) {
  return (
    <View style={s.cbRow}>
      <View style={s.cbBox}>
        {checked && <Text style={s.cbMark}>✓</Text>}
      </View>
      <Text style={s.cbLabel}>{label}</Text>
    </View>
  );
}

/** Empty table row (rows 1-5 of income type table) */
function EmptyTableRow({ label, sub }: { label: string; sub?: string }) {
  return (
    <View style={s.tableRow}>
      <View style={s.colType}>
        <Text style={s.cellText}>{label}</Text>
        {sub && <Text style={s.cellSub}>{sub}</Text>}
      </View>
      <View style={s.colDate} />
      <View style={s.colAmt} />
      <View style={s.colTax} />
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function Tawi50Document(props: Tawi50Props) {
  const {
    companyName, companyTaxId, companyAddress, signatoryName,
    tutorName, tutorNationalId, tutorAddress,
    documentNumber, periodMonth, issuedDate, paymentDate,
    grossAmount, withholdingTax,
  } = props;

  const periodLabel   = thaiPeriodLabel(periodMonth);
  const whtWords      = bahtToWords(withholdingTax);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ═══ TOP HEADER ═══ */}
        <View style={s.headerRow}>
          {/* Left: ฉบับที่ 1 / ฉบับที่ 2 */}
          <View style={{ flexDirection: "row", gap: 4 }}>
            <View style={s.copyBox}>
              <Text style={s.copyLabel}>ฉบับที่ 1</Text>
              <Text style={s.copyNote}>(สำหรับผู้ถูกหักภาษี ณ ที่จ่าย/ใช้แนบพร้อมกับแสดงรายการภาษี)</Text>
            </View>
            <View style={s.copyBox}>
              <Text style={s.copyLabel}>ฉบับที่ 2</Text>
              <Text style={s.copyNote}>(สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)</Text>
            </View>
          </View>
          {/* Right: เลขที่ */}
          <View style={s.docNumBox}>
            <View style={s.docNumRow}>
              <Text style={s.docNumLabel}>เลขที่</Text>
              <View style={s.docNumLine}>
                <Text style={{ fontSize: F, paddingLeft: 2, paddingTop: 1 }}>{documentNumber}</Text>
              </View>
            </View>
            <View style={s.docNumRow}>
              <Text style={s.docNumLabel}>เล่มที่</Text>
              <View style={s.docNumLine} />
            </View>
          </View>
        </View>

        {/* ═══ TITLE ═══ */}
        <View style={s.titleBox}>
          <Text style={s.titleMain}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</Text>
          <Text style={s.titleSub}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</Text>
        </View>

        {/* ═══ PAYER (ผู้มีหน้าที่หักภาษีฯ) ═══ */}
        <Text style={s.sectionLabel}>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :-</Text>

        {/* Tax ID row — label left, digit boxes right */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: F - 0.5, marginRight: 4 }}>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</Text>
            <DigitBoxRow value={companyTaxId} />
          </View>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoKey}>ชื่อ</Text>
          <View style={s.infoVal}>
            <Text style={{ fontSize: F, fontWeight: "bold" }}>{companyName}</Text>
            <Text style={s.infoValNote}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
            <CB label="สาขา เลขที่" />
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#000", width: 40, height: 11 }} />
          </View>
        </View>
        <View style={s.infoRow}>
          <Text style={[s.infoKey, { width: 14 }]}>ที่อยู่</Text>
          <View style={s.infoVal}>
            <Text style={{ fontSize: F }}>{companyAddress}</Text>
            <Text style={s.infoValNote}>(ให้ระบุ ชื่ออาคาร/บ้าน หมู่บ้าน ตึก ห้อง ชั้น เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</Text>
          </View>
        </View>

        <View style={s.thickDivider} />

        {/* ═══ PAYEE (ผู้ถูกหักภาษีฯ) ═══ */}
        <Text style={s.sectionLabel}>ผู้ถูกหักภาษี ณ ที่จ่าย :-</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: F - 0.5, marginRight: 4 }}>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</Text>
            <DigitBoxRow value={tutorNationalId} />
          </View>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoKey}>ชื่อ</Text>
          <View style={s.infoVal}>
            <Text style={{ fontSize: F, fontWeight: "bold" }}>{tutorName}</Text>
            <Text style={s.infoValNote}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</Text>
          </View>
          <View style={{ flexDirection: "row", marginLeft: 8, alignItems: "center", gap: 4 }}>
            <CB checked label="บุคคลธรรมดา" />
            <CB label="บริษัทหรือห้างหุ้นส่วนนิติบุคคล" />
            <CB label="อื่นๆ" />
          </View>
        </View>
        <View style={s.infoRow}>
          <Text style={[s.infoKey, { width: 14 }]}>ที่อยู่</Text>
          <View style={s.infoVal}>
            <Text style={{ fontSize: F }}>{tutorAddress || "_______________________________________________"}</Text>
            <Text style={s.infoValNote}>(ให้ระบุ ชื่ออาคาร/บ้าน หมู่บ้าน ตึก ห้อง ชั้น เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</Text>
          </View>
        </View>

        <View style={s.thickDivider} />

        {/* ═══ FORM TYPE (ลำดับที่ + ประเภทแบบ) ═══ */}
        <View style={{ borderWidth: 0.5, borderColor: "#000", padding: 4, marginBottom: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* ลำดับที่ + ในแบบ */}
            <View style={{ flexDirection: "row", alignItems: "center", marginRight: 12, flexShrink: 0 }}>
              <Text style={{ fontSize: F, fontWeight: "bold" }}>ลำดับที่</Text>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#000", width: 28, height: 11, marginHorizontal: 3 }} />
              <Text style={{ fontSize: F, fontWeight: "bold" }}>ในแบบ</Text>
            </View>
            {/* Checkboxes — two rows */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", flexWrap: "nowrap", marginBottom: 2 }}>
                <CB label="(1) ภ.ง.ด.1ก" />
                <CB label="(2) ภ.ง.ด.1ก พิเศษ" />
                <CB label="(3) ภ.ง.ด.2" />
                <CB checked label="(4) ภ.ง.ด.3" />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "nowrap" }}>
                <CB label="(5) ภ.ง.ด.2ก" />
                <CB label="(6) ภ.ง.ด.3ก" />
                <CB label="(7) ภ.ง.ด.53" />
              </View>
            </View>
          </View>
          <Text style={{ fontSize: F - 1.5, color: "#666", marginTop: 2 }}>
            (ได้สามารถส่งหนังสือรับรองฉบับนี้แทนกัน หนังสือรับรองฯ กับแบบยื่นรายการภาษีที่จ่าย)
          </Text>
        </View>

        {/* ═══ INCOME TYPE TABLE ═══ */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeaderRow}>
            <View style={s.colType}>
              <Text style={s.tableHeaderText}>ประเภทเงินได้พึงประเมินที่จ่าย</Text>
            </View>
            <View style={s.colDate}>
              <Text style={s.tableHeaderText}>วัน เดือน{"\n"}หรือปีภาษีที่จ่าย</Text>
            </View>
            <View style={s.colAmt}>
              <Text style={s.tableHeaderText}>จำนวนเงินที่จ่าย</Text>
            </View>
            <View style={s.colTax}>
              <Text style={s.tableHeaderText}>ภาษีที่หัก{"\n"}และนำส่งไว้</Text>
            </View>
          </View>

          {/* Row 1 */}
          <EmptyTableRow
            label="1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)"
          />

          {/* Row 2 */}
          <EmptyTableRow
            label="2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)"
          />

          {/* Row 3 */}
          <EmptyTableRow
            label="3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)"
          />

          {/* Row 4 */}
          <EmptyTableRow
            label="4. ดอกเบี้ย / เงินปันผล ฯลฯ ตามมาตรา 40 (4)"
            sub="(ก) ดอกเบี้ย (ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ"
          />

          {/* Row 5 */}
          <EmptyTableRow
            label="5. การจ่ายเงินได้ที่ต้องหักภาษีฯ ตามคำสั่งกรมสรรพากร ตามมาตรา 3 เตรส"
            sub="เช่น รางวัล ส่วนลด ค่าแสดง ค่าจ้างโฆษณา ค่าบริการ ฯลฯ"
          />

          {/* Row 6 — filled */}
          <View style={s.tableRowFilled}>
            <View style={s.colType}>
              <Text style={s.cellTextBold}>6. อื่นๆ (ระบุ) ค่าบริการ / ค่าจ้างสอน</Text>
              <Text style={s.cellSub}>ตามมาตรา 40 (8) รอบบิล {periodLabel}</Text>
            </View>
            <View style={s.colDate}>
              <Text style={[s.cellText, { textAlign: "center" }]}>{paymentDate}</Text>
            </View>
            <View style={s.colAmt}>
              <Text style={[s.cellTextBold, { textAlign: "right" }]}>{formatAmt(grossAmount)}</Text>
            </View>
            <View style={s.colTax}>
              <Text style={[s.cellTextBold, { textAlign: "right" }]}>{formatAmt(withholdingTax)}</Text>
            </View>
          </View>

          {/* Total row */}
          <View style={s.tableRowTotal}>
            <View style={s.colType}>
              <Text style={[s.cellTextBold, { textAlign: "right", paddingRight: 6 }]}>
                รวมเงินที่จ่ายและภาษีที่หักนำส่ง
              </Text>
            </View>
            <View style={s.colDate} />
            <View style={s.colAmt}>
              <Text style={[s.cellTextBold, { textAlign: "right" }]}>{formatAmt(grossAmount)}</Text>
            </View>
            <View style={s.colTax}>
              <Text style={[s.cellTextBold, { textAlign: "right" }]}>{formatAmt(withholdingTax)}</Text>
            </View>
          </View>
        </View>

        {/* ═══ WHT IN WORDS ═══ */}
        <View style={s.whtWordsRow}>
          <View style={s.whtWordsLabel}>
            <Text style={{ fontSize: F, fontWeight: "bold" }}>
              รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)
            </Text>
          </View>
          <Text style={s.whtWordsValue}>{whtWords}</Text>
        </View>

        {/* ═══ FUND CONTRIBUTIONS (กบข./กสจ./ประกันสังคม) ═══ */}
        <View style={s.fundRow}>
          <Text style={{ fontSize: F, fontWeight: "bold", marginRight: 6 }}>
            เงินที่จ่ายเข้า
          </Text>
          <Text style={s.fundLabel}>กบข./กสจ.</Text>
          <View style={s.fundField}><Text style={{ fontSize: F }}>  </Text></View>
          <Text style={s.fundLabel}>บาท  กองทุนประกันสังคม</Text>
          <View style={s.fundField}><Text style={{ fontSize: F }}>  </Text></View>
          <Text style={s.fundLabel}>บาท  กองทุนสำรองเลี้ยงชีพ</Text>
          <View style={s.fundField}><Text style={{ fontSize: F }}>  </Text></View>
          <Text style={s.fundLabel}>บาท</Text>
        </View>

        {/* ═══ PAYMENT TYPE ═══ */}
        <View style={s.payTypeRow}>
          <Text style={s.payTypeLabel}>ผู้จ่ายเงิน</Text>
          <View style={s.payTypeOptions}>
            <CB checked label="(1) หัก ณ ที่จ่าย" />
            <CB label="(2) ออกให้ตลอดไป" />
            <CB label="(3) ออกให้ครั้งเดียว" />
            <CB label="(4) อื่นๆ (ระบุ) .................." />
          </View>
        </View>

        {/* ═══ CAUTION ═══ */}
        <View style={s.cautionBox}>
          <Text style={[s.cautionText, { fontWeight: "bold" }]}>คำเตือน</Text>
          <Text style={s.cautionText}>
            ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ต้องปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
            รัฐมนตรี ต้องรับโทษทางปกครองตามมาตรา 35 แห่งประมวลรัษฎากร
          </Text>
        </View>

        {/* ═══ SIGNATURE ═══ */}
        <View style={s.sigRow}>
          {/* Left: ขอรับรองว่า... */}
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: F - 0.5, lineHeight: 1.5 }}>
              ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
            </Text>
          </View>
          {/* Right: signature block */}
          <View style={s.sigBlock}>
            <Text style={{ fontSize: F, marginBottom: 20 }}>ลงชื่อ .............................................</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>({signatoryName})</Text>
            <Text style={s.sigRole}>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</Text>
            <View style={s.sigDateRow}>
              <Text style={s.sigDateLabel}>วัน เดือน ปี</Text>
              <View style={s.sigDateLine}>
                <Text style={{ fontSize: F, paddingLeft: 2, paddingTop: 1 }}>{issuedDate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ FOOTER NOTE ═══ */}
        <View style={s.footerNote}>
          <Text style={s.footerNoteText}>
            หมายเหตุ  เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* หมายถึง
            1. กรณีบุคคลธรรมดาไทย ให้ใช้เลขประจำตัวประชาชนของกรมการปกครอง
            {"  "}2. กรณีนิติบุคคล ให้ใช้เลขทะเบียนนิติบุคคลของกรมพัฒนาธุรกิจการค้า
            {"  "}3. กรณีอื่นๆ นอกเหนือจากข้อ 1 และ 2 ให้ใช้เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของกรมสรรพากร
          </Text>
          <Text style={[s.footerNoteText, { marginTop: 2, color: "#888" }]}>
            สร้างโดยระบบ Tutor Advantage  ·  เอกสาร: {documentNumber}  ·  รอบบิล: {periodLabel}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
