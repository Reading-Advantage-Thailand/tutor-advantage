// Thai UI strings: "docs" namespace. Owner: G1. Append-only.
import { registerMessages } from "../../lib/i18n";

export const docs = {
  title: "คู่มือระบบภายใน",
  description: "ศูนย์รวมความรู้และวิธีการทำงานสำหรับผู้ดูแลระบบ Tutor Advantage",
  helpTitle: "ยังต้องการความช่วยเหลือ?",
  helpDescription: "หากคุณไม่พบข้อมูลที่ต้องการ กรุณาติดต่อทีมงาน Support โดยตรงผ่านช่องทาง LINE",
  support: "ติดต่อเจ้าหน้าที่",
  adminGuide: "คู่มือสำหรับแอดมิน Tutor Advantage",
  pageTitle: "คู่มือระบบ",
  pageDescription: "ขั้นตอนการทำงานมาตรฐาน กฎความเสี่ยง และภาพรวมระบบสำหรับผู้ดูแล",
  contents: "สารบัญ",
  backToTop: "กลับด้านบน",
  supportCta: "ติดต่อทีมงานทาง LINE",
} as const;

registerMessages("docs", docs);
