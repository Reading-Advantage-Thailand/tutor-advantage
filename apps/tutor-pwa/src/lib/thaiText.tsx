import { Fragment, type ReactNode } from "react";
import { NBSP, noOrphan } from "./format";

/**
 * Words and phrases that the browser's Thai line breaker (ICU) splits in two,
 * kept on one line (patterns.md "Thai text"). Ported from
 * apps/student-liff/src/lib/thaiText.tsx: the first part of the list is the
 * student list as it is there, the second part is tutor copy. The one list for
 * the whole app: the shared page, card, list, state, notice, field and sheet
 * components put their string props through it, and so do the login page, the
 * legal pages and the presenter. Kinds of entry:
 * - words ICU mis-segments, so a break could land mid-syllable: "เช็ / กชื่อ",
 *   "คลา / วด์", "คอมมิช / ชัน", "แล้วก / ดลอง", "ยอ / มรับ";
 * - compound words ICU splits into their parts: "ผู้ / ปกครอง", "ชำระ / เงิน",
 *   "เครือ / ข่าย", "ยืนยันตัว / ตน", "ข้อ / ตกลง", "บท / เรียน";
 * - a negation or helper verb with its verb ("ไม่ / ได้", "ไม่ / สามารถ",
 *   "จะ / เห็น") and short phrases that read badly when split ("ของ / คุณ",
 *   "QR / Code", "สอนต่อ / ไม่ได้");
 * - names and mixed Thai-Latin runs ("Tutor / Advantage", "ผ่าน / LINE",
 *   "Referral / Link", "บัญชี / Google");
 * - a closing phrase or a conjunction with the word after it, so a line does
 *   not end on "และ", "หรือ", "แล้ว" and a paragraph does not end on one word
 *   ("... / ได้เอง", "... / ที่สูงขึ้น");
 * - a number with its unit or label ("7 / วันทำการ", "จนครบ 22 / ชม.",
 *   "ที่ขั้น / 1", "ไม่เกิน 15 / นาที").
 *
 * Each entry is the source of a regular expression, joined as written: escape
 * a literal dot or parenthesis ("\\(\\.ics\\)"), and group with (?:...) only,
 * never with a capturing group. A number pattern takes a plain space or a
 * no-break space, because thaiCopy() glues a short last word with a no-break
 * space before the list is applied.
 *
 * The leftmost match wins, and of the entries that start at the same letter
 * the longer one ("เช็กชื่อ" over "เช็ก"). So a phrase that starts with a listed
 * word needs its own entry: "ไม่ได้รับ" beside "ไม่ได้" (or "รับ" is left
 * outside), "เข้าเรียนสด" beside "เข้าเรียน", "โบนัสเครือข่าย" beside "เครือข่าย".
 *
 * No entry may be wider than the narrowest text box it is shown in. On a 320px
 * screen those are the lesson picker's sticky bar (92px), the badge cells on
 * the performance page (116px) and the card titles beside an action (about
 * 120px). Checked on every tutor page at 320, 360, 390 and 1024.
 *
 * Which function to call:
 * - thaiCopy() for text that is read, not named: a description, a notice, a
 *   hint, a paragraph. It also glues a short last word and the repeat mark ๆ
 *   with a no-break space.
 * - thaiLabel() for text that names something (a heading, a dialog title, a
 *   field label, a button): no-wrap spans only, so the text content and the
 *   accessible name stay exactly as written.
 * - bilingualCopy() for a Thai line with its English translation after " · "
 *   or in brackets: each language wraps as its own block.
 */
const KEEP_TOGETHER = [
  // Mis-segmented by ICU.
  "เช็ก",
  "อินเทอร์เน็ต",
  "แชท",
  "แชทกลุ่ม",
  "แล้วกด",
  "แล้วกดลอง",
  "แล้วกลับ",
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
  "แอปธนาคาร",
  "ต่ำกว่า",
  "ความสัมพันธ์",
  "ความปลอดภัย",
  "ความยินยอม",
  "ความจริง",
  "ความก้าวหน้า",
  "การศึกษา",
  "ตอนนี้",
  "อีกครั้ง",
  "สักครู่",
  "ถูกต้อง",
  "ใช้งาน",
  "ลงทะเบียน",
  "เข้าสู่ระบบ",
  "บทเรียน",
  "ผลการเรียน",
  "ผลคะแนน",
  "คลาสเรียน",
  "ตารางเรียน",
  "เรียนสด",
  "คุณครู",
  "ทีมงาน",
  "หน้าหลัก",
  "วันทำการ",
  "ตอบกลับ",
  "คำตอบ",
  "คำศัพท์",
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
  "ช่องทางเดิม",
  "รหัสผ่าน",
  "เด็ดขาด",
  "หมดอายุ",
  "รายละเอียด",
  "แบบฝึกหัด",
  "สมัครเรียน",
  "ขั้นตอน",
  "ขั้นตอนสมัคร",
  "คำสั่งซื้อ",
  "สงวนสิทธิ์",
  "ทุกกรณี",
  "เต็มจำนวน",
  "ส่งมอบ",
  "การส่งมอบ",
  "การยกเลิก",
  "การชำระเงิน",
  "การคืนเงิน",
  "คืนเงิน",
  "เงินคืน",
  "ยอดคืน",
  "โอนคืน",
  "เปลี่ยนใจ",
  "รับผิดชอบ",
  "รับหนังสือ",
  "หนังสือจริง",
  "หนึ่งเล่ม",
  "เล่มใหม่",
  "รูปถ่าย",
  "หลังอนุมัติ",
  "ค่าแพ็กเกจ",
  "ค่าส่งคืน",
  "ค่าจัดส่ง",
  "ชื่อคลาส",
  "ชื่อบัญชี",
  "เลขรายการ",
  "เลขบัญชี",
  "เลขบัตร",
  "บัตรใบเดิม",
  "ผู้ออกบัตร",
  "บัตรเครดิต",
  "หน้าคลาส",
  "หน้าคลาสเรียน",
  "เปิดคลาส",
  "เปิดขาย",
  "คาบแรก",
  "ถัดไป",
  "ด้วยกัน",
  "พร้อมกัน",
  "ทันที",
  "คุณแจง",
  // A negation or helper verb with its verb, and short phrases.
  "ไม่ได้",
  "ไม่ได้รับ",
  "ไม่สำเร็จ",
  "ไม่รับ",
  "ไม่สามารถ",
  "ไม่ตัดสิทธิ",
  "แนบไฟล์ไม่ได้",
  "ได้เลย",
  "ได้เลยนะ",
  "ได้รับ",
  "จะได้รับ",
  "จะคืน",
  "จะตรวจสอบ",
  "จะเปิดให้เรียน",
  "ต้องให้",
  "ลองใช้บัตรอื่น",
  "หรือจ่ายด้วย",
  "ลองเช็กสัญญาณ",
  "ตามกำหนด",
  "ตามกำหนดได้",
  "ใช้เวลา",
  "ใช้หนังสือ",
  "ที่ใช้ชำระ",
  "ดูยอดจริง",
  "ยืนยันชำระเงิน",
  "เริ่มแล้ว",
  "ถูกย้ายไปแล้ว",
  "กลับไปหน้าหลัก",
  "กรุณาเข้าห้องเรียน",
  "เปิดให้เรียน",
  "เราจะช่วย",
  "แจ้งทีมงาน",
  "แล้วติดตาม",
  "เล่าเป็นข้อความ",
  "เรียนกับติวเตอร์",
  "มีเสียงดัง",
  "คอร์สเรียนใหม่",
  "คลาสที่เปิดขาย",
  "สิ่งที่ได้รับ",
  "ต่อผู้เรียน",
  "ต่อแพ็กเกจ",
  "ต่อแพ็กเกจหนังสือ",
  // The button name with the verb that points at it (common.errorDescription,
  // payment.promptpay.step2).
  'ลองกด "ลองอีกครั้ง"',
  "แล้วเลือก “สแกน”",
  // Names and mixed Thai-Latin runs.
  "QR Code",
  "LINE OA",
  "ผ่าน LINE",
  "เข้าสู่ระบบ LINE",
  "Reading Advantage",
  "Primary Advantage",
  "Reading Materials",
  "Student LIFF Portal",
  "Google Calendar",
  "ชำระผ่าน PromptPay",
  "จ่ายด้วย PromptPay",
  "โดย Omise",
  "โดยระบบชำระเงิน Omise",
  "บัตรเครดิต/เดบิต",
  "หรือบัตรเครดิต/เดบิต",
  "รหัส OTP",
  "รหัส CVV",
  "เลข CVV",
  "support@reading-advantage\\.com",
  "ไฟล์ปฏิทิน \\(\\.ics\\)",
  // The company address (businessContact.address): each part stays whole.
  "ตำบลบ้านเป็ด",
  "อำเภอเมืองขอนแก่น",
  "จังหวัดขอนแก่น 40000",
  "หมู่ที่[ \\u00a0]\\d+",
  // A conjunction with the word after it, and closing phrases, so no line
  // ends on "และ" / "หรือ" / "แล้ว" and no paragraph ends on a single word.
  "และบัตรเครดิต",
  "และตารางเรียน",
  "และการส่งมอบ",
  "และรางวัล",
  "และคอร์สใหม่",
  "และระยะเวลาดำเนินการ",
  "หรือเพื่อน",
  "หรือการชำระเงิน",
  "หรือเลขบัตร",
  "หรือ OTP ให้ทีมงาน",
  "หรือติดต่อทีมงาน",
  "หรือขอลิงก์ใหม่จากครูนะ",
  "แล้วจะได้รับ",
  "แล้วติดตามคำตอบได้เลยนะ",
  "แล้วยืนยันการจ่ายเงิน",
  "ระบบจะเช็กให้เอง",
  "เก็บไว้ในเครื่อง",
  "ด้วยแอปธนาคาร",
  "เมื่อมีข้อความใหม่",
  "เพื่อสมัครเรียน",
  "ก่อนสมัคร",
  "ของตัวเอง",
  "ในคลาสนี้",
  "ในหน้าคลาสเรียน",
  "ในคาบแรก",
  "ในคาบถัดไป",
  "ติวเตอร์ในคาบแรก",
  "บทเรียนพร้อมกัน",
  "เล่มใหม่ทั้งหมด",
  "ค่าธรรมเนียมการโอน",
  "ตามเงื่อนไขการคืนเงิน",
  "ที่ผู้เรียนมีตามกฎหมาย",
  "โดยไม่มีค่าใช้จ่ายเพิ่ม",
  // ── Tutor copy ──────────────────────────────────────────────────────────
  // Mis-segmented by ICU: "เช็ / กชื่อ", "คลา / วด์", "คอมมิช / ชัน".
  "เช็กชื่อ",
  "คลาวด์",
  "คอมมิชชัน",
  "เรทคอมมิชชัน",
  "ค่าคอมมิชชัน",
  "ค่าคอมมิชชันเร็วขึ้น",
  "แอดมิน",
  "ติดต่อแอดมิน",
  "หรือติดต่อแอดมิน",
  "พาสปอร์ต",
  "รูปพาสปอร์ต",
  "รูปหน้าพาสปอร์ต",
  "เลขพาสปอร์ต",
  "ลิขสิทธิ์",
  "คอนเฟตตี",
  // Compounds.
  "เครือข่าย",
  "โบนัสเครือข่าย",
  "โบนัสเครือข่ายพิเศษ",
  "ผลตอบแทนเครือข่าย",
  "ลูกข่าย",
  "ผู้แนะนำ",
  "ลิงก์ผู้แนะนำ",
  "ข้อตกลง",
  "ข้อกำหนดเหล่านี้",
  "ครูผู้สอน",
  "ผู้ใช้งาน",
  "ผู้เสียภาษี",
  "เลขประจำตัว",
  "เลขประจำตัวผู้เสียภาษี",
  "เลขประจำตัวผู้เสียภาษีหากมี",
  "ยืนยันตัวตน",
  "ค่าตอบแทน",
  "ค่าเรียน",
  "ล้าสมัย",
  "ชื่อเสียง",
  "เสียชื่อเสียง",
  "ภายนอก",
  "บุคคลภายนอก",
  "ส่วนบุคคล",
  "ข้อมูลส่วนบุคคล",
  "ข้อมูลบัญชี",
  "เข้ารหัส",
  "ที่เข้ารหัส",
  "ถูกเข้ารหัส",
  "การสอน",
  "สื่อประกอบการสอน",
  "การยอมรับ",
  "ถือเป็นการยอมรับ",
  "การบันทึก",
  "การอ่านรูป",
  "การตั้งค่า",
  "การตั้งค่าของเครื่อง",
  "การใช้งานแอป",
  "ส่งคำร้อง",
  "การเข้าถึงแอป",
  "การอัปเดตนโยบาย",
  "เข้าถึง",
  "เข้าร่วม",
  "เข้าเรียน",
  "เข้าเรียนสด",
  "เข้าเรียนฟรี",
  "ผิดปกติ",
  "ระยะเวลา",
  "ต่อเนื่อง",
  "ตรงต่อเวลา",
  "ความเป็นส่วนตัว",
  "ความรับผิดชอบ",
  "ความเข้าใจ",
  "ความพยายาม",
  "หมายเลขโทรศัพท์",
  "ประวัติการเข้าสู่ระบบ",
  "ประวัติการจ่ายเงิน",
  "รหัสไปรษณีย์",
  "บัตรประชาชน",
  "กรอกตามบัตรประชาชน",
  "สมุดบัญชีธนาคาร",
  "หนังสือเดินทาง",
  "ใบอนุญาตทำงาน",
  "บัญชีรับเงิน",
  "หน้าตั้งค่า",
  "รอบบิล",
  "รอบจ่ายเงิน",
  "รอบถัดไป",
  "รอบปิดยอดแรก",
  "คาบถัดไป",
  "เล่มถัดไป",
  "ฉบับปรับปรุง",
  "บทสนทนา",
  "พูดคุย",
  "ทะลุเป้า",
  "สรุปย้อนหลัง",
  "ข้อความเข้า",
  "แต่ละรายการ",
  "แยกกัน",
  "แต่ละรายการแยกกัน",
  "ส่วนไหน",
  "ลำดับตายตัว",
  "ผลกระทบจริง",
  "คำศัพท์ประกอบ",
  "เลขบัตรเต็ม",
  "หรือเลขบัตรเต็ม",
  "คลาสใดคลาสหนึ่ง",
  "จัดการคลาส",
  "สร้างห้องเรียน",
  "สร้างห้องเรียนได้ทันที",
  "เลือกบทเรียน",
  "เลือกบทที่จะสอน",
  "ออกจากห้อง",
  "ช่องว่าง:",
  // A negation or helper verb with its verb, and short phrases.
  "ไม่ได้รับอนุญาต",
  "ยังไม่ได้ยืนยัน",
  "ไม่ต้องจ่ายเงิน",
  "ไม่เก็บค่าเรียน",
  "จะไม่เก็บค่าเรียน",
  "สอนต่อไม่ได้",
  "ถูกปฏิเสธ",
  "ถูกย้ายแล้ว",
  "ถูกบันทึกปกติ",
  "จะถูกบันทึกปกติ",
  "ให้ความสำคัญ",
  "ให้ปลอดภัย",
  "ให้ครบก่อน",
  "เก็บรวบรวม",
  "จะเห็น",
  "จะแสดงที่นี่",
  "ทำอะไร",
  "ทำไมถึงสำคัญ",
  "พร้อมใช้",
  "เปิดดูได้",
  "เข้ามาใหม่ได้",
  "ได้เอง",
  "เลือกหนังสือได้เอง",
  "ได้ทันที",
  "ได้ในที่เดียว",
  "เร็วขึ้น",
  "ลองใหม่อีกครั้ง",
  "เริ่มสอนใหม่",
  "คนอื่นรอ",
  "พูดบ้าง",
  "อีกฝ่ายพูดบ้าง",
  "คุ้นเคยแล้ว",
  "นักเรียนแล้ว",
  "นักเรียนเงียบ",
  "นักเรียนทุกคน",
  "มาเรียนและมาสาย",
  "หากสอนนอกตาราง",
  "หนังสือนี้ตอนสมัคร",
  "วันหมดอายุให้",
  "ส่งลิงก์ให้นักเรียน",
  "ลากไฟล์มาวาง",
  "โดยชอบด้วยกฎหมาย",
  "อย่างโปร่งใส",
  "อย่างต่อเนื่อง",
  // A possessive, a preposition or a relative ที่ with the word after it, and
  // closing phrases, so a line does not end on "ของ", "ใน", "ที่", "และ".
  "ของคุณ",
  "ของเรา",
  "ของคลาส",
  "ของเครื่อง",
  "ของหนังสือ",
  "บทเรียนแรกของหนังสือ",
  "ของบทเรียน",
  "ของนักเรียน",
  "ของตนเอง",
  "ทีมของคุณ",
  "ข้อมูลของคุณ",
  "ข้อมูลส่วนบุคคลของคุณ",
  "ลิงก์แนะนำของคุณ",
  "แพลตฟอร์มของเรา",
  "ทั้งเล่ม",
  "การเลื่อนเล่ม",
  "ในวันนี้",
  "ในตอนนี้",
  "ในห้องเรียน",
  "ในบทเรียน",
  "ในบทเรียนนี้",
  "ที่จะสอน",
  "ที่จะสอนในวันนี้",
  "ที่จะได้เรียน",
  "ที่พร้อมใช้",
  "ที่ระบุ",
  "ที่ผิดปกติ",
  "ที่เปิดดูได้",
  "ที่ชำระเงินแล้ว",
  "ที่อยากเล่น",
  "ที่ครูส่งให้",
  "ที่สูงขึ้น!?",
  "ที่กำหนด",
  "ที่กำหนดไว้",
  "ตามวัตถุประสงค์ที่กำหนด",
  "ที่มีลิขสิทธิ์",
  "หรือล้าสมัย",
  "หรือบทสนทนา",
  "และนักเรียน",
  "และไม่บันทึกผล",
  "และเป็นปัจจุบัน",
  "ตามกฎหมาย",
  "ตามรอบบิล",
  "จากทีมงาน",
  "ก่อนเปิดห้อง",
  "ก่อนเริ่มสอน",
  "ระหว่างซ้อม",
  "หลังสร้าง",
  "เมื่อปิดรอบ",
  "เพื่อเชิญนักเรียน",
  "เพื่อความปลอดภัย\\)",
  // Names and mixed Thai-Latin runs.
  "Tutor Advantage",
  "LINE Official",
  "Referral Link",
  "Google Gemini",
  "Auto-fill",
  "sentence frames",
  "สร้าง curiosity",
  "บัญชี Google",
  "กรุณาใช้ Google",
  "Class ID เดิม",
  "เมื่อปิดรอบจ่ายเงิน",
  // The withholding term with its rate: "หัก ณ ที่จ่าย 3%", "หัก ณ ที่จ่าย 15%".
  "หัก[ \\u00a0]ณ[ \\u00a0]ที่จ่าย[ \\u00a0]\\d+%",
  "\\((?:Guided Writing|Language Questions)\\)",
  // A number with its unit or label: "7 วัน", "3–7 วันทำการ", "บทที่ 5",
  // "มีบทอ่าน 14 เรื่อง", "(รวม 11 วัน)", "เวลา 18:00-20:00 น.".
  "\\d+(?:–\\d+)?[ \\u00a0]วัน(?:ทำการ)?",
  "บทที่[ \\u00a0]\\d+",
  "Milestone บทที่[ \\u00a0]\\d+",
  "มีบทอ่าน[ \\u00a0]\\d+[ \\u00a0]เรื่อง",
  "\\(รวม[ \\u00a0]\\d+[ \\u00a0]วัน\\)",
  "(?:เวลา[ \\u00a0])?\\d{1,2}:\\d{2} ?- ?\\d{1,2}:\\d{2}(?:[ \\u00a0]น\\.)?",
  // Tutor copy: "18 ขั้นตอน", "18 ขั้นตอน (4 คาบ)", "24 ชม.", "จนครบ 22 ชม.", "ใบ 50 ทวิ",
  // "4 ตัวท้าย", "2-3 นาที", "ก่อนสอน 30 นาที", "หลังพ้น 14 วัน", "ที่ขั้น 1",
  // "ที่เฟส 7", and the figure of a badge: "เกิน 10 ครั้ง", "ไม่เกิน 15 นาที",
  // "สูงกว่า 4.8", "เกิน 80%".
  "\\d+[ \\u00a0]ขั้นตอน(?:[ \\u00a0]\\(\\d+[ \\u00a0]คาบ\\))?",
  "\\(\\d+[ \\u00a0]คาบ\\)",
  "(?:จนครบ[ \\u00a0])?\\d+[ \\u00a0]ชม\\.",
  "ใบ[ \\u00a0]50[ \\u00a0]ทวิ",
  "\\d+[ \\u00a0]ตัวท้าย",
  "\\d+-\\d+[ \\u00a0]นาที",
  "ก่อนสอน[ \\u00a0]\\d+[ \\u00a0]นาที",
  "หลังพ้น[ \\u00a0]\\d+[ \\u00a0]วัน",
  "ที่ขั้น[ \\u00a0]\\d+",
  "ที่เฟส[ \\u00a0]\\d+",
  "(?:สูงกว่า|ไม่เกิน|เกิน)[ \\u00a0]\\d+(?:\\.\\d+)?%?(?:[ \\u00a0](?:ครั้ง|นาที))?",
  // The count after a heading, with its dot and its unit: "· 5 ประโยค" (presenter key sentences).
  "(?:·[ \\u00a0])?\\d+[ \\u00a0]ประโยค",
  // A dash stays on the line of the word before it (tutorClass couponHelp).
  "ให้นักเรียน[ \\u00a0]—",
  // The network part of the wallet sub-line stays whole: no line ends on "+" and the
  // bonus amount is never alone (dashboardHome commissionWithNetwork).
  "\\+[ \\u00a0]โบนัสเครือข่าย[ \\u00a0]฿[\\d,.]+",
];
const KEEP_PATTERN = new RegExp(`(${[...KEEP_TOGETHER].sort((a, b) => b.length - a.length).join("|")})`);

/** The text with each listed word or phrase in a no-wrap span; other text is unchanged. */
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
 * Thai copy for a line box that wraps (a state description, a notice, a sheet
 * description, a hint, a paragraph): a short last word stays with the one
 * before it, ๆ stays with the word it repeats and no listed word or phrase
 * splits across lines. Anything that is not a string (the caller's own markup,
 * or data such as a class name passed as a node) is returned unchanged.
 */
export function thaiCopy(content: ReactNode): ReactNode {
  if (typeof content !== "string") return content;
  // The repeat mark ๆ never starts a line: glue it to the word it repeats.
  return keepThaiWords(noOrphan(content.replace(/ ๆ/g, `${NBSP}ๆ`)));
}

/**
 * Thai text that names something: a heading, a card or dialog title, a field
 * label, a button. Listed words stay whole and nothing else changes: no
 * no-break space is added, so the text content, and with it the accessible
 * name, is exactly the string passed in. Non-strings are returned unchanged.
 */
export function thaiLabel(content: ReactNode): ReactNode {
  return typeof content === "string" ? keepThaiWords(content) : content;
}

/** One language of a bilingual line: it wraps inside its own box, never mixed with the other. */
const LANGUAGE_BLOCK = "inline-block max-w-full";
const THAI_LETTER = /[฀-๿]/;
/** An English gloss in brackets after Thai text: " (Full name as on passport)". */
const ENGLISH_GLOSS = / (\([A-Za-z][^()]*\))/;

/** English text with its last two words together, so it does not end on one word alone. */
function englishText(text: string): ReactNode {
  const tail = /^(.*\s)(\S+\s\S+)$/.exec(text);
  if (!tail) return keepThaiWords(text);
  return (
    <>
      {keepThaiWords(tail[1])}
      <span className="whitespace-nowrap">{tail[2]}</span>
    </>
  );
}

/** Thai text with each English gloss in brackets as its own block. */
function withGloss(text: string, thai: (content: ReactNode) => ReactNode): ReactNode {
  const parts = text.split(ENGLISH_GLOSS);
  if (parts.length === 1) return thai(text);
  // split() with a capture group: odd indexes are the glosses, without the space before them.
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <Fragment key={index}>
        {" "}
        <span className={LANGUAGE_BLOCK}>{englishText(part)}</span>
      </Fragment>
    ) : part ? (
      <Fragment key={index}>{thai(part)}</Fragment>
    ) : null,
  );
}

/**
 * A Thai line with its English translation: "ไทย · English" or
 * "ไทย (English)". Each language is one inline block, so on a narrow screen
 * the line breaks between the languages first and each language then wraps
 * on its own lines; the dot leads the English block, so it never ends a line.
 * The Thai part goes through thaiCopy(), or through thaiLabel() with `label`
 * for a field or checkbox label: the text content is then the string passed
 * in, character for character. Non-strings are returned unchanged.
 */
export function bilingualCopy(content: ReactNode, options: { label?: boolean } = {}): ReactNode {
  if (typeof content !== "string") return content;
  const thai = options.label ? thaiLabel : thaiCopy;
  const language = (text: string) => (THAI_LETTER.test(text) ? withGloss(text, thai) : englishText(text));
  const halves = content.split(" · ");
  if (halves.length === 1) return withGloss(content, thai);
  return halves.map((half, index) =>
    index === 0 ? (
      <span key={index} className={LANGUAGE_BLOCK}>
        {language(half)}
      </span>
    ) : (
      <Fragment key={index}>
        {" "}
        <span className={LANGUAGE_BLOCK}>· {language(half)}</span>
      </Fragment>
    ),
  );
}
