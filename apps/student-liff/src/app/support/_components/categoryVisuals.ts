import type { LucideIcon } from "lucide-react";
import {
  BookX,
  CalendarDays,
  MessageCircleQuestion,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
} from "lucide-react";
import type { IconTileTone } from "@/components/mobile";

export interface CategoryVisual {
  icon: LucideIcon;
  tone: IconTileTone;
  /**
   * Authored line-break units for the label in a tight tile grid (patterns.md
   * "Thai text"): each piece is kept whole, lines may only break between them.
   * Joined, they must equal the i18n label exactly; OptionPicker falls back to
   * its own rule when they do not (so a copy change can never alter the text).
   */
  segments?: readonly string[];
}

/**
 * Icon + tile tone per ticket category (one tone per meaning, components.md §5:
 * payment orange, schedule purple, books brand, account teal, app blue).
 * Unknown values read as "อื่นๆ", like getCategoryLabelKey.
 */
const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  REFUND: { icon: ReceiptText, tone: "orange", segments: ["คืนเงิน/", "ยกเลิก"] },
  BOOK_DELIVERY: { icon: Truck, tone: "brand", segments: ["หนังสือ", "ยังไม่ได้รับ/", "ส่งช้า"] },
  BOOK_DAMAGED: { icon: BookX, tone: "pink", segments: ["หนังสือ", "ชำรุด/", "ผิดเล่ม"] },
  CLASS: { icon: CalendarDays, tone: "purple", segments: ["คลาสเรียน/", "ตารางเรียน"] },
  PAYOUT: { icon: Wallet, tone: "amber" },
  PRIVACY: { icon: ShieldCheck, tone: "teal", segments: ["ข้อมูล", "ส่วนตัว/", "ลบบัญชี"] },
  TECHNICAL: { icon: Smartphone, tone: "blue", segments: ["ปัญหา", "การใช้งานแอป"] },
  OTHER: { icon: MessageCircleQuestion, tone: "neutral" },
};

export function getCategoryVisual(category: string | null | undefined): CategoryVisual {
  return CATEGORY_VISUALS[category ?? ""] ?? CATEGORY_VISUALS.OTHER;
}
