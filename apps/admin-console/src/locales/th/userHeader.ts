// Thai UI strings: "userHeader" namespace — the /users/[id] header, tabs and
// verification field names (used by users/[id]/layout.tsx and model.ts).
// Split from "userDetail" so the layout doesn't ship every user-detail string.
// Owner: G4. Append-only.
import { registerMessages } from "../../lib/i18n";

export const userHeader = {
  anonymizedNotice: "บัญชีนี้ถูกลบข้อมูลส่วนบุคคลแล้วเมื่อ {date} ข้อมูลธุรกรรมยังเก็บไว้เพื่อการตรวจสอบบัญชี",
  backToList: "กลับไปรายการผู้ใช้",
  loadError: "โหลดข้อมูลไม่สำเร็จ",
  noEmail: "ไม่มีอีเมล (สมัครผ่าน LINE)",
  pendingCount: "รอตรวจ {count} รายการ",
  piiMaskedNotice: "ข้อมูลส่วนบุคคลบางส่วนถูกซ่อนตามสิทธิ์ผู้ตรวจสอบการเงิน",
  tabAudit: "ประวัติกิจกรรม",
  tabClasses: "คลาสและการลงทะเบียน",
  tabPayments: "การชำระเงิน",
  tabProfile: "ข้อมูลทั่วไป",
  tabVerification: "เอกสารยืนยันตัวตน",
  tabsLabel: "ส่วนของข้อมูลผู้ใช้",
  userId: "รหัสผู้ใช้",
  userNotFound: "ไม่พบผู้ใช้งาน",
  bankBook: "หน้าสมุดบัญชี",
  deliveryAddress: "ที่อยู่สำหรับส่งเอกสาร",
  idCard: "สำเนาบัตรประชาชน",
  taxInfo: "ข้อมูลภาษีสำหรับใบ 50 ทวิ",
  unnamed: "ไม่ระบุชื่อ",
} as const;

registerMessages("userHeader", userHeader);
