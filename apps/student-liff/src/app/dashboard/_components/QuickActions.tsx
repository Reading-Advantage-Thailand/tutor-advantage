import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Calendar, CreditCard, History, MessageCircle } from "lucide-react";
import { IconTile, SectionHeader, type IconTileTone } from "@/components/mobile";
import { t, type I18nKey } from "@/lib/i18n";
import { formatBadgeCount } from "./dashboardModel";

interface QuickAction {
  id: string;
  href: string;
  icon: LucideIcon;
  tone: IconTileTone;
  label: I18nKey;
  sub: I18nKey;
}

const ACTIONS: QuickAction[] = [
  { id: "quick-chat", href: "/chat", icon: MessageCircle, tone: "blue", label: "dashboard.chatTutor", sub: "dashboard.chatTutorSub" },
  { id: "quick-schedule", href: "/schedule", icon: Calendar, tone: "purple", label: "dashboard.schedule", sub: "dashboard.scheduleSub" },
  { id: "quick-history", href: "/lesson/history", icon: History, tone: "brand", label: "dashboard.lessonHistory", sub: "dashboard.lessonHistorySub" },
  { id: "quick-payment", href: "/payment/history", icon: CreditCard, tone: "amber", label: "dashboard.payment", sub: "dashboard.paymentSub" },
];

/** 2×2 grid of big tappable tiles; the chat tile carries the unread badge. Server-compatible. */
export function QuickActions({ unread }: { unread: number }) {
  return (
    <section aria-labelledby="quick-menu-title">
      <SectionHeader title={<span id="quick-menu-title">{t("dashboard.quickMenu")}</span>} />
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => {
          const badge = action.id === "quick-chat" && unread > 0 ? formatBadgeCount(unread) : null;
          return (
            <Link
              key={action.id}
              id={action.id}
              href={action.href}
              className="pressable relative flex min-h-[112px] flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-4 text-left shadow-[var(--shadow-card)] active:bg-press"
            >
              <IconTile icon={action.icon} tone={action.tone} />
              <span className="min-w-0">
                <span className="block text-[15px] leading-[1.5] font-semibold text-fg">{t(action.label)}</span>
                <span className="block text-[13px] leading-[1.5] text-fg-muted">{t(action.sub)}</span>
              </span>
              {badge ? (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute top-3 right-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-danger-solid px-1.5 text-xs leading-none font-bold text-white tabular-nums"
                  >
                    {badge}
                  </span>
                  <span className="sr-only">
                    {t("dashboard.unreadAria")} {unread}
                  </span>
                </>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
