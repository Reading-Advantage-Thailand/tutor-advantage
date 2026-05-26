/**
 * Tawi50Document — Thai withholding tax certificate (ใบ 50 ทวิ)
 * หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
 *
 * Rendered server-side via @react-pdf/renderer renderToBuffer().
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";

// ── Font registration ──────────────────────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(FONTS_DIR, "Sarabun-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS_DIR, "Sarabun-Bold.ttf"), fontWeight: "bold" },
  ],
});

// Prevent react-pdf from breaking Thai words at combining-character boundaries.
// Without this, characters like สระ ี and mai han akat get separated from their base consonant.
Font.registerHyphenationCallback((word) => [word]);

// ── Types ──────────────────────────────────────────────────────────────────
export type Tawi50Props = {
  // Payer (company)
  companyName: string;
  companyTaxId: string;
  companyAddress: string;
  signatoryName: string; // person who signs the document

  // Payee (tutor)
  tutorName: string;
  tutorNationalId: string; // blank if unknown
  tutorAddress: string;    // blank if unknown

  // Payout details
  documentNumber: string;
  periodMonth: string;    // "2025-05"
  issuedDate: string;     // formatted Thai date — document issue date
  paymentDate: string;    // formatted Thai date — money transfer date
  grossAmount: number;    // THB
  withholdingTax: number; // THB
  netPayout: number;      // THB
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTHB(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thaiPeriodLabel(periodMonth: string): string {
  try {
    const [year, month] = periodMonth.split("-").map(Number);
    const thaiMonths = [
      "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    ];
    return `${thaiMonths[month] ?? ""} ${year + 543}`;
  } catch {
    return periodMonth;
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 9,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 36,
    color: "#111",
  },

  // Title
  titleBox: { alignItems: "center", marginBottom: 8 },
  titleMain: { fontSize: 15, fontWeight: "bold", textAlign: "center" },
  titleSub: { fontSize: 10, textAlign: "center", marginTop: 2 },
  titleDocNum: { fontSize: 8, textAlign: "center", color: "#555", marginTop: 3 },

  // Section headers
  sectionHeader: {
    backgroundColor: "#1a56db",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 9,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 5,
    marginTop: 8,
  },

  // Info rows (label : value)
  infoTable: { width: "100%" },
  infoRow: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
  infoLabel: { width: 150, fontWeight: "bold", color: "#444", flexShrink: 0 },
  infoValue: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: "#aaa", borderBottomStyle: "dashed", paddingBottom: 2, minHeight: 13 },

  // Income table
  tableContainer: { marginTop: 6, borderWidth: 0.5, borderColor: "#999" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#e8f0fe",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  tableRowTotal: {
    flexDirection: "row",
    backgroundColor: "#f0f4ff",
    borderTopWidth: 1,
    borderTopColor: "#1a56db",
  },
  colNo:   { width: "5%",  textAlign: "center", paddingVertical: 4, paddingHorizontal: 2 },
  colType: { flex: 1,      paddingVertical: 4, paddingHorizontal: 4 },
  colDate: { width: "18%", textAlign: "center", paddingVertical: 4, paddingHorizontal: 2 },
  colAmt:  { width: "16%", textAlign: "right",  paddingVertical: 4, paddingHorizontal: 4 },
  colTax:  { width: "14%", textAlign: "right",  paddingVertical: 4, paddingHorizontal: 4 },
  colRate: { width: "8%",  textAlign: "center", paddingVertical: 4, paddingHorizontal: 2 },
  tableHeaderText: { fontWeight: "bold", fontSize: 8 },
  cellBorder: { borderRightWidth: 0.5, borderRightColor: "#999" },

  // WHT summary
  whtBox: {
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: "#1a56db",
    borderRadius: 2,
    padding: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f4ff",
  },
  whtLabel: { fontWeight: "bold", fontSize: 10 },
  whtAmt: { fontSize: 12, fontWeight: "bold", color: "#1a56db" },

  // Note
  noteBox: {
    marginTop: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 0.5,
    borderColor: "#f59e0b",
    padding: 5,
    borderRadius: 2,
  },
  noteText: { fontSize: 8, color: "#92400e" },

  // Signature
  sigBox: { marginTop: 20, flexDirection: "row", justifyContent: "flex-end" },
  sigBlock: { width: 200, alignItems: "center" },
  sigLine: { borderTopWidth: 0.5, borderTopColor: "#333", width: "100%", marginBottom: 4 },
  sigName: { fontSize: 9, fontWeight: "bold", textAlign: "center" },
  sigRole: { fontSize: 8, color: "#555", textAlign: "center", marginTop: 2 },
  sigDate: { fontSize: 8, color: "#555", textAlign: "center", marginTop: 8 },

  // Footer
  footer: {
    marginTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#888" },
});

// ── Component ──────────────────────────────────────────────────────────────
export function Tawi50Document(props: Tawi50Props) {
  const {
    companyName,
    companyTaxId,
    companyAddress,
    signatoryName,
    tutorName,
    tutorNationalId,
    tutorAddress,
    documentNumber,
    periodMonth,
    issuedDate,
    paymentDate,
    grossAmount,
    withholdingTax,
    netPayout,
  } = props;

  const periodLabel = thaiPeriodLabel(periodMonth);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Title ── */}
        <View style={s.titleBox}>
          <Text style={s.titleMain}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</Text>
          <Text style={s.titleSub}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</Text>
          <Text style={s.titleDocNum}>
            เลขที่เอกสาร: {documentNumber}{"  "}รอบบิล: {periodLabel}{"  "}วันที่ออกเอกสาร: {issuedDate}
          </Text>
        </View>

        {/* ── Payer ── */}
        <View style={s.sectionHeader}>
          <Text>ผู้จ่ายเงิน (Payer)</Text>
        </View>
        <View style={s.infoTable}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ชื่อผู้จ่ายเงิน</Text>
            <Text style={s.infoValue}>{companyName}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>เลขประจำตัวผู้เสียภาษี</Text>
            <Text style={s.infoValue}>{companyTaxId}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ที่อยู่</Text>
            <Text style={s.infoValue}>{companyAddress}</Text>
          </View>
        </View>

        {/* ── Payee ── */}
        <View style={s.sectionHeader}>
          <Text>ผู้มีเงินได้ (Payee)</Text>
        </View>
        <View style={s.infoTable}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ชื่อผู้มีเงินได้</Text>
            <Text style={s.infoValue}>{tutorName}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>เลขประจำตัวผู้เสียภาษี</Text>
            <Text style={s.infoValue}>{tutorNationalId || "_______________"}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ที่อยู่</Text>
            <Text style={s.infoValue}>{tutorAddress || "_______________"}</Text>
          </View>
        </View>

        {/* ── Income table ── */}
        <View style={s.sectionHeader}>
          <Text>รายละเอียดเงินได้และการหักภาษี</Text>
        </View>

        <View style={s.tableContainer}>
          <View style={s.tableHeader}>
            <View style={[s.colNo, s.cellBorder]}><Text style={s.tableHeaderText}>ลำดับ</Text></View>
            <View style={[s.colType, s.cellBorder]}><Text style={s.tableHeaderText}>ประเภทเงินได้</Text></View>
            <View style={[s.colDate, s.cellBorder]}><Text style={s.tableHeaderText}>วันที่จ่าย</Text></View>
            <View style={[s.colAmt, s.cellBorder]}><Text style={s.tableHeaderText}>จำนวนเงิน (บาท)</Text></View>
            <View style={[s.colTax, s.cellBorder]}><Text style={s.tableHeaderText}>ภาษีที่หัก (บาท)</Text></View>
            <View style={s.colRate}><Text style={s.tableHeaderText}>อัตรา</Text></View>
          </View>

          <View style={s.tableRow}>
            <View style={[s.colNo, s.cellBorder]}><Text>1</Text></View>
            <View style={[s.colType, s.cellBorder]}>
              <Text>ค่าบริการ / ค่าจ้างทำของ</Text>
              <Text style={{ fontSize: 7.5, color: "#555", marginTop: 1 }}>(ภ.ง.ด.53 ม.40(8))</Text>
            </View>
            <View style={[s.colDate, s.cellBorder]}><Text>{paymentDate}</Text></View>
            <View style={[s.colAmt, s.cellBorder]}><Text>{formatTHB(grossAmount)}</Text></View>
            <View style={[s.colTax, s.cellBorder]}><Text>{formatTHB(withholdingTax)}</Text></View>
            <View style={s.colRate}><Text>3%</Text></View>
          </View>

          <View style={s.tableRowTotal}>
            <View style={[s.colNo, s.cellBorder]}><Text> </Text></View>
            <View style={[s.colType, s.cellBorder]}><Text style={{ fontWeight: "bold" }}>รวมทั้งสิ้น</Text></View>
            <View style={[s.colDate, s.cellBorder]}><Text> </Text></View>
            <View style={[s.colAmt, s.cellBorder]}><Text style={{ fontWeight: "bold" }}>{formatTHB(grossAmount)}</Text></View>
            <View style={[s.colTax, s.cellBorder]}><Text style={{ fontWeight: "bold" }}>{formatTHB(withholdingTax)}</Text></View>
            <View style={s.colRate}><Text> </Text></View>
          </View>
        </View>

        {/* ── WHT Summary ── */}
        <View style={s.whtBox}>
          <View>
            <Text style={s.whtLabel}>ยอดรับสุทธิหลังหักภาษี</Text>
            <Text style={{ fontSize: 8, color: "#444", marginTop: 2 }}>
              รวมเงินได้ {formatTHB(grossAmount)} บาท  {" "}
              หักภาษี ณ ที่จ่าย {formatTHB(withholdingTax)} บาท
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, color: "#555" }}>ยอดสุทธิ</Text>
            <Text style={s.whtAmt}>{formatTHB(netPayout)} บาท</Text>
          </View>
        </View>

        {/* ── Note ── */}
        <View style={s.noteBox}>
          <Text style={s.noteText}>
            * เอกสารนี้ออกโดย {companyName}
            {" "}เพื่อรับรองว่าได้หักภาษี ณ ที่จ่ายในอัตรา 3% สำหรับการให้บริการของ {tutorName}
            {" "}ในรอบบิล {periodLabel} และได้นำส่งกรมสรรพากรเรียบร้อยแล้ว
          </Text>
        </View>

        {/* ── Signature ── */}
        <View style={s.sigBox}>
          <View style={s.sigBlock}>
            <Text style={{ fontSize: 8, marginBottom: 28 }}>ลงชื่อ .....................................................</Text>
            <View style={s.sigLine} />
            <Text style={s.sigName}>({signatoryName})</Text>
            <Text style={s.sigRole}>ผู้มีอำนาจลงนาม / ผู้จ่ายเงิน</Text>
            <Text style={s.sigRole}>{companyName}</Text>
            <Text style={s.sigDate}>วันที่ {issuedDate}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>เลขที่เอกสาร: {documentNumber}</Text>
          <Text style={s.footerText}>สร้างโดยระบบ Tutor Advantage  ·  ใบ 50 ทวิ</Text>
          <Text style={s.footerText}>รอบบิล: {periodLabel}</Text>
        </View>

      </Page>
    </Document>
  );
}
