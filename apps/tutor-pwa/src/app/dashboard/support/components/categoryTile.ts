import {
  BookOpen,
  BookX,
  MessageCircleQuestion,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TileTone } from "@/components/app";
import type { TicketCategory } from "../lib/support";

const TILES: Record<TicketCategory, { icon: LucideIcon; tone: TileTone }> = {
  REFUND: { icon: RotateCcw, tone: "orange" },
  BOOK_DELIVERY: { icon: Truck, tone: "teal" },
  BOOK_DAMAGED: { icon: BookX, tone: "pink" },
  CLASS: { icon: BookOpen, tone: "blue" },
  PAYOUT: { icon: Wallet, tone: "orange" },
  PRIVACY: { icon: ShieldCheck, tone: "purple" },
  TECHNICAL: { icon: Smartphone, tone: "amber" },
  OTHER: { icon: MessageCircleQuestion, tone: "neutral" },
};

/** Tone tile per ticket category (list rows, category tiles, thread header). Presentation only. */
export function categoryTile(category: string | null | undefined): { icon: LucideIcon; tone: TileTone } {
  return TILES[category as TicketCategory] ?? TILES.OTHER;
}
