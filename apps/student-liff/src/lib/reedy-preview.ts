export const REEDY_PREVIEW_EVENT = "dev:reedy-preview";
export const REEDY_READING_PREVIEW_EVENT = "dev:reedy-reading-preview";
export const REEDY_READING_PREVIEWS = [
  ["offer", "💬 ชวนเปิดบทความ"], ["open", "📖 เปิดหน้าอ่าน"],
  ["next", "👉 ชี้ประโยคถัดไป"], ["word", "✨ แสดงคำศัพท์"],
  ["listen", "👂 รอนักเรียนอ่าน"], ["reset", "↩ จบการทดสอบ"],
] as const;
export const REEDY_POSES = [
  ["idle", "👋 ทักทาย"], ["connecting", "⏳ รอเชื่อมต่อ"],
  ["listening", "👂 ตั้งใจฟัง"], ["thinking", "💭 คิด"],
  ["speaking", "💬 พูด"], ["muted", "☕ พักฟัง"],
  ["celebrating", "🎉 ดีใจ"], ["reassuring", "💚 ให้กำลังใจ"],
] as const;
