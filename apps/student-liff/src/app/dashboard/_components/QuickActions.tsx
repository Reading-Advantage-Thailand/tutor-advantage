import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Calendar, CreditCard, History, MessageCircle } from "lucide-react";
import { IconTile, type IconTileTone } from "@/components/mobile";
import { t, type I18nKey } from "@/lib/i18n";
import { formatBadgeCount } from "./dashboardModel";

interface QuickAction {
  id: string;
  href: string;
  icon: LucideIcon;
  tone: IconTileTone;
  label: I18nKey;
  /** Authored two-line label (patterns.md "Thai text"): the first line ends after this phrase. */
  breakAfter: string;
  sub: I18nKey;
}

// One tone per meaning (components.md §5): chat blue, schedule purple, history teal, payment orange.
const ACTIONS: QuickAction[] = [
  { id: "quick-chat", href: "/chat", icon: MessageCircle, tone: "blue", label: "dashboard.chatTutor", breakAfter: "แชท", sub: "dashboard.chatTutorSub" },
  { id: "quick-schedule", href: "/schedule", icon: Calendar, tone: "purple", label: "dashboard.schedule", breakAfter: "ตาราง", sub: "dashboard.scheduleSub" },
  { id: "quick-history", href: "/lesson/history", icon: History, tone: "teal", label: "dashboard.lessonHistory", breakAfter: "ประวัติ", sub: "dashboard.lessonHistorySub" },
  { id: "quick-payment", href: "/payment/history", icon: CreditCard, tone: "orange", label: "dashboard.payment", breakAfter: "ประวัติ", sub: "dashboard.paymentSub" },
];

/** Splits a label after `breakAfter` (แชท/ติวเตอร์); one line when the copy no longer starts with it. */
function splitLabel(label: string, breakAfter: string): [string, string | null] {
  if (!label.startsWith(breakAfter) || label.length === breakAfter.length) return [label, null];
  return [breakAfter, label.slice(breakAfter.length)];
}

/**
 * Quick menu (patterns.md S1.3): four tappable 60px tiles (rim + clay ledge)
 * in one row with authored two-line labels; the chat tile carries the unread
 * badge. The short help line stays for screen readers. Server-compatible.
 */
export function QuickActions({ unread }: { unread: number }) {
  return (
    <nav aria-label={t("dashboard.quickMenu")} className="grid grid-cols-4 gap-2">
      {ACTIONS.map((action) => {
        const badge = action.id === "quick-chat" && unread > 0 ? formatBadgeCount(unread) : null;
        const [first, second] = splitLabel(t(action.label), action.breakAfter);
        return (
          <Link
            key={action.id}
            id={action.id}
            href={action.href}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-[20px] pt-1 pb-1 text-center [-webkit-tap-highlight-color:transparent]"
          >
            <span className="relative">
              <IconTile
                icon={action.icon}
                tone={action.tone}
                size="quick"
                className="transition-[translate,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] group-active:translate-y-[2px] group-active:shadow-[0_1px_0_var(--clay-ledge)]"
              />
              {badge ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-solid px-1.5 text-xs leading-none font-semibold text-on-danger tabular-nums ring-2 ring-surface"
                >
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="font-heading text-sm leading-[1.35] font-semibold text-fg">
              <span className="block">{first}</span>
              {second ? <span className="block">{second}</span> : null}
            </span>
            <span className="sr-only">{t(action.sub)}</span>
            {badge ? (
              <span className="sr-only">
                {t("dashboard.unreadAria")} {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
