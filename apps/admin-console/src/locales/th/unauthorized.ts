// Thai UI strings: "unauthorized" namespace. Owner: G5. Append-only.
import { registerMessages } from "../../lib/i18n";

export const unauthorized = {
  title: "ไม่มีสิทธิ์เข้าถึงระบบ",
  description:
    "บัญชี Google ของคุณยังไม่ได้รับการอนุมัติให้เข้าถึงแผงควบคุมระบบ (Admin Console) ของ Tutor Advantage",
  nextStepsTitle: "สิ่งที่คุณต้องทำ:",
  nextStepsDescription:
    "กรุณาติดต่อผู้ดูแลระบบ (Super Admin) หรือฝ่าย IT Support เพื่อขอรับสิทธิ์การเข้าถึงระบบตามระดับงานของคุณ",
  support: "ติดต่อเจ้าหน้าที่ (Support)",
  backLogin: "กลับไปหน้าเข้าสู่ระบบ",
  // ── G5 redesign (appended) ──
  pageTitle: "ไม่มีสิทธิ์เข้าถึง",
  signedInTitle: "บัญชีนี้ไม่มีสิทธิ์เปิดหน้านี้",
  signedInDescription: "คุณเข้าสู่ระบบเป็น {name} ({role}) หน้านี้เปิดได้เฉพาะผู้ดูแลระบบ ถ้าต้องใช้งาน ให้ขอสิทธิ์จากผู้ดูแลระบบ หรือออกจากระบบแล้วเข้าด้วยบัญชีอื่น",
  signedOutTitle: "บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าคอนโซล",
  signedOutDescription: "บัญชี Google ที่ใช้ไม่ได้เป็นผู้ดูแลระบบหรือผู้ตรวจสอบการเงินของ Tutor Advantage ให้ผู้ดูแลระบบเพิ่มสิทธิ์ที่หน้า “สิทธิ์ผู้ดูแล” แล้วเข้าสู่ระบบใหม่",
  goHome: "กลับหน้าภาพรวม",
  switchAccount: "ออกจากระบบและเปลี่ยนบัญชี",
  loggingOut: "กำลังออกจากระบบ…",
  contactSupport: "ติดต่อทีมงาน",
} as const;

registerMessages("unauthorized", unauthorized);
