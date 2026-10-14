// Thai UI strings: "verification" namespace. Append-only; keep keys sorted by feature.
export const verification = {
  idCard: "บัตรประชาชน",
  bankBook: "สมุดบัญชีธนาคาร",
  address: "ที่อยู่สำหรับส่งเอกสาร",
  pendingTitle: "เอกสารอยู่ระหว่างตรวจสอบ",
  rejectedTitle: "การยืนยันตัวตนถูกปฏิเสธ",
  requiredTitle: "กรุณายืนยันตัวตนเพื่อรับเงิน",
  rejectionReason: "เหตุผลที่ต้องแก้ไข:",
  defaultRejectComment: "ไม่ผ่านการตรวจสอบ กรุณาส่งข้อมูลใหม่",
  submittedPrefix: "ส่งแล้ว:",
  reviewingSuffix: "เจ้าหน้าที่กำลังตรวจสอบ",
  reviewingDocuments: "เจ้าหน้าที่กำลังดำเนินการตรวจสอบเอกสารของคุณ",
  openSettingsToResubmit: "กรุณาเปิดหน้าตั้งค่าเพื่อดูรายการที่ไม่ผ่านและส่งข้อมูลใหม่",
  missingPrefix: "ยังขาด:",
  notVerifiedWarning: "คุณยังไม่ได้ยืนยันตัวตน ระบบจะไม่สามารถโอนเงินรายได้เข้าบัญชีได้",
} as const;
