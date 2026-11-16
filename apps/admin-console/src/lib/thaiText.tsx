import type { ReactNode } from "react";
import { NBSP, noOrphan } from "./format";

/**
 * Words and phrases that the browser's Thai line breaker (ICU) splits in two,
 * kept on one line. Ported from apps/student-liff/src/lib/thaiText.tsx (the
 * general vocabulary; the student-only phrases were left behind) and extended
 * for the admin console's copy. The one list for the whole console: page
 * descriptions, stat labels and hints, notices, empty / error / status
 * screens, sheet and confirm descriptions, field hints and the docs pages all
 * go through it. Kinds of entry:
 * - words ICU mis-segments, so a break could land mid-syllable: "เช็ / กชื่อ",
 *   "จะบัน / ทึก", "ค่าคอมมิช / ชัน";
 * - compound words ICU splits into their parts: "ชำระ / เงิน", "ประวัติ /
 *   กิจกรรม", "ผู้ตรวจ / สอบ", "ย้อน / หลัง", "ภาย / หลัง", "การ / เงิน";
 * - a negation or helper verb with its verb ("ไม่ / สำเร็จ", "ยังไม่ / ได้",
 *   "จะ / ลบ", "ถูก / บันทึก") and the prefixes การ / ความ / ผู้ with their word
 *   ("การ / ปรับยอด", "ความ / เสี่ยง", "ผู้ / ใช้");
 * - names and mixed Thai-Latin runs ("Reading / Advantage", "กับ / Google"),
 *   and a button, filter or status name inside its quotation marks
 *   ("“ยกเลิกฉบับ / ร่าง”");
 * - a closing phrase, so a paragraph does not end on one short word
 *   ("... / อนุมัติ", "... / ภายหลัง", "... / เท่านั้น");
 * - a number with its unit or label ("2 / เคส", "30,000 / บาท", "เช่น /
 *   1,500.00", "ทุกวันที่ / 1", "00:00 / น.", "ตุลาคม / 2569", "ใบ / 50 ทวิ").
 *
 * Each entry is the source of a regular expression, joined as written: escape
 * a literal dot or parenthesis ("ม\\.ค\\."). A number pattern takes a plain
 * space or a no-break space, because thaiCopy() glues a short last word with
 * a no-break space before the list is applied.
 *
 * The leftmost match wins, and of the entries that start at the same letter
 * the longer one ("บันทึกในประวัติกิจกรรม" over "บันทึก"). So a phrase that
 * starts with a listed word needs its own entry: "ไม่ได้รับ" beside "ไม่ได้" (or
 * "รับ" is left outside), "การโอนเงิน" beside "การโอน", "รอบจ่ายเงินครู" beside
 * "รอบจ่าย". And an entry must not end on the first half of another listed
 * word, or it takes that half and the rest is left outside: "ในรอบ" would
 * split "รอบจ่ายเงิน", "ไม่ได้รับเงิน" would split "เงินโอนอัตโนมัติ" (hence
 * the lookaheads), and a การ entry names the whole word after it
 * ("การตรวจสอบ" beside "การตรวจ").
 *
 * Where a line breaks depends on the width of the box, so a phrase that looks
 * right at 320 and 390 can still split at 360, 375 or 412: check a new or
 * changed string at each phone width, not only the two design widths.
 *
 * A kept run cannot break, so no entry may be wider than the narrowest text
 * box its copy is shown in. On a 320px screen those are the stat label (71px
 * at 13px medium), the work-queue title (75px at 14px semibold, where
 * "ปรับปรุงยอด" is 74px), the checklist label (100px), the audit action in
 * its card (110px at 15px), the stat hint (111px at 12px) and the login alert
 * (176px). The long closing phrases (up to 150px at 13px) and the quoted
 * names (up to 124px) only occur in descriptions, notices, dialogs and rule
 * lists, which are 198px and wider. Of the prefix entries, "การตรวจสอบ" (71px
 * at 13px), "การดำเนินการ" (73px), "การลงทะเบียน" (75px) and "ความเคลื่อนไหว"
 * (82px) are as wide as a stat label or wider: none of them is used in a stat
 * label or a work-queue title today, so check before putting one there. The role
 * name "ผู้ตรวจสอบการเงิน" is deliberately two entries: as one run it is wider
 * than a stat label. Before adding an entry, measure it against the boxes its
 * copy appears in at 320px.
 */
const KEEP_TOGETHER = [
  // ── From the student list: general vocabulary ──────────────────────────
  // Mis-segmented by ICU.
  "เช็ก",
  "เช็กชื่อ",
  "อินเทอร์เน็ต",
  "แชท",
  "แล้วกด",
  "ยอมรับ",
  "อายุ",
  "แพ็กเกจ",
  // Compounds.
  "ผู้ปกครอง",
  "ผู้เรียน",
  "พร้อมเพย์",
  "จ่ายเงิน",
  "การจ่ายเงิน",
  "ชำระเงิน",
  "การชำระเงิน",
  "ความสัมพันธ์",
  "ความปลอดภัย",
  "ความยินยอม",
  "ตอนนี้",
  "อีกครั้ง",
  "สักครู่",
  "ถูกต้อง",
  "ใช้งาน",
  "ลงทะเบียน",
  "เข้าสู่ระบบ",
  "บทเรียน",
  "คลาสเรียน",
  "ตารางเรียน",
  "คุณครู",
  "ทีมงาน",
  "วันทำการ",
  "ตอบกลับ",
  "คำตอบ",
  "ตรวจสอบ",
  "หลักฐาน",
  "ข้อผิดพลาด",
  "ตั้งค่า",
  "แจ้งเตือน",
  "เชื่อมต่อ",
  "รายการ",
  "ด้านล่าง",
  "ตัวเอง",
  "ช่องทาง",
  "รหัสผ่าน",
  "หมดอายุ",
  "รายละเอียด",
  "สมัครเรียน",
  "ขั้นตอน",
  "การยกเลิก",
  "การคืนเงิน",
  "คืนเงิน",
  "เงินคืน",
  "รับผิดชอบ",
  "หลังอนุมัติ",
  "ชื่อคลาส",
  "ชื่อบัญชี",
  "เลขบัญชี",
  "เลขบัตร",
  "บัตรเครดิต",
  "เปิดคลาส",
  "ถัดไป",
  "พร้อมกัน",
  "ทันที",
  // A negation or helper verb with its verb.
  "ไม่ได้",
  "ไม่ได้รับ",
  "ไม่สำเร็จ",
  "ไม่สามารถ",
  "ได้เลย",
  "ได้รับ",
  "จะได้รับ",
  "ต้องให้",
  "ตามกำหนด",
  "ของตัวเอง",
  // Names and mixed Thai-Latin runs.
  "QR Code",
  "LINE OA",
  "ผ่าน LINE",
  "Reading Advantage",
  "Primary Advantage",
  "รหัส OTP",

  // ── Admin console copy ─────────────────────────────────────────────────
  // Mis-segmented by ICU: "จะบัน / ทึก", "ค่าคอมมิช / ชัน", "ก / ระ / ทำ",
  // "แด / ช / บอร์ด", "ดึงส / ถานะ", "มากกว่าย / อด", "พรี / วิว", "อัป / โหลด".
  "บันทึก",
  "ค่าคอมมิชชัน",
  "กระทำ",
  "ดึงสถานะ",
  "แดชบอร์ด",
  "ผลกระทบ",
  "ว่ายอด",
  "มากกว่ายอด",
  "กับคาบ",
  "แอดมิน",
  "รีดี้",
  "มิฉะนั้น",
  "จะพากลับ",
  "พรีวิว",
  "อัปโหลด",
  // Compounds.
  "ประวัติกิจกรรม",
  "รอบจ่าย",
  "รอบจ่ายเงิน",
  "รอบจ่ายเงินครู",
  "รอบจ่ายเดียวกัน",
  "โอนเงิน",
  "ยอดเงิน",
  "ยอดชำระ",
  "ยอดรายได้ครู",
  "พักเงิน",
  "เรียกเงินคืน",
  "เงินโอนอัตโนมัติ",
  "หักภาษี",
  "ค่าตอบแทน",
  "ค่าสอนชดเชย",
  "รายเดือน",
  "รายครู",
  "รายการปรับยอด",
  "รายการในระบบ",
  "ปรับปรุงยอด",
  "หน้าปรับปรุงยอด",
  "คำนวณใหม่",
  "ลองใหม่",
  "ภายหลัง",
  "ย้อนหลัง",
  "ย้อนกลับไม่ได้",
  "ผิดปกติ",
  "ที่อยู่",
  "หน้านี้",
  "เดือนนั้น",
  "ช่วงเวลานี้",
  "เวลาไทย",
  "เจ้าหน้าที่",
  "ระบบพัฒนา",
  "บัญชีธนาคาร",
  "สมุดบัญชี",
  "สมุดบัญชีธนาคาร",
  "รับเงิน",
  "บัญชีรับเงิน",
  "บัตรประชาชน",
  "เลขบัตรประชาชน",
  "ส่วนบุคคล",
  "ข้อมูลส่วนบุคคล",
  "สิทธิ์เรียน",
  "ยืนยันตัวตน",
  "ส่งเอกสาร",
  "ส่งออก",
  "ส่งอนุมัติ",
  "ดำเนินการ",
  "เรียกใช้งาน",
  "ใช้งานได้",
  "ใช้งานอยู่",
  "ใช้โค้ด",
  "คนละโค้ด",
  "สร้างรอบ",
  "เข้าถึง",
  "ไปยัง",
  "เกินไป",
  "โดยเร็ว",
  "จากนั้น",
  "ข้อความว่า",
  "กฎกันโกง",
  "หลายนักเรียน",
  "เมนูการเงิน",
  "การเงิน",
  "ตีกลับ",
  "เพิกถอน",
  "คัดลอก",
  "ภาพรวม",
  "ฐานข้อมูล",
  "จับคู่",
  "ตัวกรอง",
  "เบอร์โทร(?:ศัพท์)?",
  "เฝ้าระวัง",
  "เพิ่มเติม",
  "เสร็จสิ้น",
  "ปลายทาง",
  "เชื่อใจ",
  "ทีละ",
  "นำไป",
  "นำมา",
  "ล้มเหลว",
  "เริ่มต้น",
  "ตรวจทาน",
  "เป้าหมาย",
  "ล่วงหน้า",
  "ช่วยเหลือ",
  "ตัดสินใจ",
  "หน้าจอ",
  "ปานกลาง",
  "เบื้องต้น",
  "รูปแบบ",
  "ทางลัด",
  "มุมมอง",
  "ผิดพลาด",
  "พื้นฐาน",
  "ครบถ้วน",
  "น่าสงสัย",
  "ปลดล็อก",
  "นักพัฒนา",
  "เครื่องมือ",
  "แผงควบคุม",
  "คำค้น",
  "คำค้นหา",
  "ข้อจำกัด",
  "รายคาบ",
  "ถอดเสียง",
  "หมดเวลา",
  "ที่นี่",
  "บางส่วน",
  "บางคน",
  "รวมถึง",
  "ครั้งแรก",
  "ครั้งเดียว",
  "ฉบับร่าง",
  "ลงเรียน",
  "จำนวนเงิน",
  "รายได้",
  "เรียกเก็บ",
  "รอบบิล",
  "รอบนี้",
  "ยอดรวม",
  "ยอดสุทธิ",
  "ยอดจ่าย",
  "ยอดโอน",
  "ยอดขาย",
  "ยอดชำระเงิน",
  "ยอดเรียกเก็บ",
  // The prefixes การ / ความ / ผู้ stay on their word.
  "การเข้าสู่ระบบ",
  "การลงเรียน",
  "การสมัครเรียน",
  "การปรับยอด",
  "การปรับปรุงยอด",
  "การเปลี่ยนแปลง",
  "การเปลี่ยนสิทธิ์",
  "การระงับบัญชี",
  "การยืนยันตัวตน",
  "การโอน",
  "การโอนเงิน",
  "การส่งออก",
  "การส่งต่อโค้ด",
  "การทุจริต",
  "การทำรายการ",
  "การโต้แย้งรายการ",
  "การเรียกใช้งาน",
  "การเชื่อมต่อ",
  "การรับเงิน",
  "ความเสี่ยง",
  "ความผิดพลาด",
  "ผู้ใช้",
  "ผู้ใช้งาน",
  "ผู้ดูแล",
  "ผู้ดูแลระบบ",
  "ผู้รับเงิน",
  "ผู้ตรวจสอบ",
  "ผู้จัดทำ",
  "ผู้สร้างรายการ",
  "ผู้ดำเนินการ",
  "ผู้ให้บริการ",
  // A word that ends in การ is listed itself, or the การ entry after it would
  // start inside it: "ต้อง[การอนุมัติ]", "จัด[การปรับปรุงยอด]".
  "ต้องการ",
  "จัดการ",
  "กระบวนการ",
  "การกระทำ",
  "การชำระ",
  "การอนุมัติ",
  "การไม่อนุมัติ",
  "การปฏิเสธ",
  "การตรวจ",
  "การตรวจสอบ",
  "การจัดการ",
  "การใช้",
  "การใช้งาน",
  "การแก้ไข",
  "การดำเนินการ",
  "การดำเนินงาน",
  "การตั้งค่า",
  "การปรับปรุง",
  "การแจ้งเตือน",
  "การทำ",
  "การทำงาน",
  "การเรียก",
  "การเรียกเก็บ",
  "การเช็กชื่อ",
  "การเข้าเรียน",
  "การเข้าถึง",
  "การปิด",
  "การเปิด",
  "การฝึก",
  "การคำนวณ",
  "การคำนวณใหม่",
  "การระงับ",
  "การล้าง",
  "การลบ",
  "การลบข้อมูล",
  "การค้นหา",
  "การเปลี่ยน",
  "การเคลื่อนไหว",
  "การปฏิบัติ",
  "การดูแล",
  "การตัดสินใจ",
  "การจับคู่",
  "การอัปเดต",
  "การให้",
  "การรักษา",
  "การสร้าง",
  "การจ่าย",
  "การเลือก",
  "การยืนยัน",
  "การรับ",
  "การเชื่อใจ",
  "การลงทะเบียน",
  "การเริ่ม",
  "ความผิดปกติ",
  "ความช่วยเหลือ",
  "ความหมาย",
  "ความรู้",
  "ความสอดคล้อง",
  "ความเป็น",
  "ความเคลื่อนไหว",
  "ความเห็น",
  "ความครบถ้วน",
  "ผู้แจ้ง",
  "ผู้ตรวจ",
  "ผู้แนะนำ",
  "ผู้มี",
  "ผู้ไม่มี",
  "ผู้อื่น",
  "ผู้ส่ง",
  "ผู้สร้าง",
  "ผู้เช็กชื่อ",
  "ผู้ทำ",
  // A negation or helper verb with its verb.
  "ไม่บันทึก",
  "ไม่ผ่าน",
  "ไม่ให้",
  "ไม่เกิน",
  "ไม่จำกัด",
  "ไม่ตรงกัน",
  "ที่ไม่ตรงกัน",
  "ไม่ถูกต้อง",
  "ไม่อนุมัติ",
  "ไม่คืนเงิน",
  "ไม่เปิดสิทธิ์เรียน",
  "ยังไม่ได้",
  "ยังไม่ได้รับ",
  "ยังไม่มี",
  "ไม่ได้รับเงิน(?!โอน)",
  "ไม่พบ",
  "ไม่ทราบ",
  "ไม่ระบุ",
  "ไม่คาดคิด",
  "ไม่เปลี่ยน(?:แปลง)?",
  "ยังไม่เปิด",
  "ยังไม่สร้าง",
  "ยังไม่อนุมัติ",
  "ใช้ซ้ำไม่ได้",
  "อนุมัติไม่ได้",
  "ของตัวเองไม่ได้",
  "เปิดได้",
  "ส่งมาแล้ว",
  "จะลบ",
  "ลบข้อมูล",
  "จะปฏิเสธ",
  "จะรอไว้",
  "จะคำนวณใหม่",
  "จะไม่ถูกยกไป",
  "จะไม่แตะ",
  "จะหายไป",
  "จะสร้าง",
  "จะปิด",
  "(?:จะ)?ถูกรวม",
  "ถูกตีกลับ",
  "ถูกเรียกเงินคืน",
  "ต้องจ่าย",
  "ต้องติดตาม",
  "ต้องตรวจสอบโดยเร็ว",
  "รอตรวจ(?:สอบ)?",
  "รอไว้",
  "หลังฝึก",
  "ถูกเปิด",
  "ถูกระงับ",
  "ถูกบันทึก",
  "ถูกบันทึกด้วย",
  "จะถูกบันทึก",
  "ต้องคำนวณใหม่",
  "ลามไปถึง",
  "รออนุมัติ",
  "รอลงทะเบียน",
  "อนุมัติแล้ว",
  "ที่อนุมัติแล้ว",
  "ปิดแล้ว",
  "อีกคน",
  "อีกคนอนุมัติ",
  "อีกคนอนุมัติแล้ว",
  "อาจเป็นเพราะ",
  "เพื่อบังคับใช้",
  "เพื่อยืนยัน",
  "ที่เลือก",
  // A button, filter or status name stays inside its quotation marks:
  // “คำนวณใหม่”, “ส่งให้อนุมัติ”, “ยกเลิกฉบับร่าง”, “ตรวจสอบกับ Omise”. The cap
  // is the longest name in the copy, “ตรวจสอบการชำระเงิน” (124px at 13px);
  // a longer quotation wraps as usual. Quoted names only occur in
  // descriptions, notices, dialogs and the docs pages (198px and wider).
  "“[^”\\n]{1,18}”",
  // Names and mixed Thai-Latin runs.
  "กับ Google",
  "PromptPay ไม่จำกัด",
  "Maker[-–]Checker",
  // A conjunction with the word after it, and closing phrases, so no
  // paragraph ends on a single short word.
  "และระงับ",
  "และทุจริต",
  "และไม่คืนเงิน",
  "และจัดการบัญชี",
  "และสอบทานการอนุมัติ",
  "และผู้ตรวจสอบการเงินอนุมัติ",
  "และประวัติธุรกรรมยังอยู่",
  "หรือวิกฤต",
  "หรือนักเรียน",
  "หรือออกจากระบบ",
  "หรือลบไม่ได้",
  "ออกจากระบบ",
  "แล้วลองใหม่",
  "ลองใหม่อีกครั้ง",
  "ลองใหม่ภายหลัง",
  "เข้าสู่ระบบใหม่",
  "เข้าสู่ระบบใหม่อีกครั้ง",
  "บัญชีองค์กรอื่น",
  "ที่คุณเปิดไว้",
  "ในระบบพัฒนา",
  "บทบาทที่เลือก",
  "ทุกการทำรายการ",
  "ทุกการเปลี่ยนแปลง",
  "บันทึกในประวัติ",
  "บันทึกในประวัติกิจกรรม",
  "หมายเหตุทุกครั้ง",
  "ทดสอบเท่านั้น",
  "ในรอบ(?:นี้|(?!จ่าย))",
  "ในขั้นตอนนี้",
  "ได้ภายหลัง",
  "เองภายหลัง",
  "ที่สร้างรอบ",
  "ยอดที่จ่ายเกิน",
  "เปิดใช้งานอีกครั้ง",
  "ยกเลิกสิทธิ์อัตโนมัติ",
  // A closing question keeps its question mark: "... ใช่หรือ / ไม่?".
  "(?:ใช่)?หรือไม่\\?",
  // The repeat mark stays with the word it repeats ("อื่น / ๆ").
  "อื่น[ \\u00a0]ๆ",
  "ต่าง[ \\u00a0]ๆ",
  // A number with its unit or label: "2 เคส", "30,000 บาท", "90 วันแรก",
  // "3–7 วันทำการ", "เช่น 1,500.00", "ราคาเหลือ ฿0", "ทุก 1 นาที",
  // "อย่างน้อย 1 คนเสมอ", "ออกใบ 50 ทวิ", "ภาษีหัก ณ ที่จ่าย".
  "\\d[\\d,.]*(?:–\\d[\\d,.]*)?[ \\u00a0](?:วัน(?:ทำการ|แรก)?|เคส|รายการ|ราย(?![\\u0E01-\\u0E4E])|รอบ(?!จ่าย)|คน|ใบ|บาท|นาที|วินาที|ชั่วโมง|ชม\\.|ตำแหน่ง|ครั้ง|แถว|คาบ|โค้ด|คลาส|ตาราง|ตัวอักษร|ที่นั่ง|คิว)",
  "เช่น[ \\u00a0]\\d[\\d,.]*",
  "(?:ราคา)?เหลือ[ \\u00a0]฿[\\d,]+",
  "ทุก[ \\u00a0]\\d+[ \\u00a0]นาที",
  "อย่างน้อย[ \\u00a0]\\d+[ \\u00a0]คน(?:เสมอ)?",
  "(?:ออก)?ใบ[ \\u00a0]50[ \\u00a0]ทวิ",
  "ณ[ \\u00a0]ที่จ่าย",
  // Dates and times: "ทุกวันที่ 1", "เวลา 00:00 น.", "18:00–19:30 น.",
  // "ตุลาคม 2569", "20 มิ.ย.", "20 มิ.ย. 2569", "2026-11".
  "\\d{4}-\\d{2}(?:-\\d{2})?",
  "ทุกวันที่[ \\u00a0]\\d+",
  "(?:เวลา[ \\u00a0])?\\d{1,2}:\\d{2}(?: ?[-–] ?\\d{1,2}:\\d{2})?(?:[ \\u00a0]น\\.)?",
  "(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)[ \\u00a0]\\d{4}",
  "\\d{1,2}[ \\u00a0](?:ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.)(?:[ \\u00a0]\\d{4})?",
];
const KEEP_PATTERN = new RegExp(`(${[...KEEP_TOGETHER].sort((a, b) => b.length - a.length).join("|")})`);

/**
 * The text with each listed word or phrase in a no-wrap span; other text is
 * unchanged. The text content stays the same character for character, so it is
 * safe for anything that forms an accessible name (a stat label, a heading, a
 * queue title, a form label).
 */
export function keepThaiWords(text: string): ReactNode {
  const parts = text.split(KEEP_PATTERN);
  if (parts.length === 1) return text;
  // split() with a capture group: odd indexes are the matched compounds.
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Thai copy for a line box that wraps (a page or state description, a notice,
 * a sheet description, a field hint, a paragraph): a short last word stays
 * with the one before it, ๆ stays with the word it repeats and no listed word
 * or phrase splits across lines. Anything that is not a string (the caller's
 * own markup, or data such as a class name passed as a node) is returned
 * unchanged.
 */
export function thaiCopy(content: ReactNode): ReactNode {
  if (typeof content !== "string") return content;
  // The repeat mark ๆ never starts a line: glue it to the word it repeats.
  return keepThaiWords(noOrphan(content.replace(/ ๆ/g, `${NBSP}ๆ`)));
}
