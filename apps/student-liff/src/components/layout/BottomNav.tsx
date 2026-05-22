"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Activity, User } from "lucide-react";
import { t } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/dashboard", label: t("app.navHome"), Icon: Home },
  { href: "/classes", label: t("app.navClasses"), Icon: BookOpen },
  { href: "/progress", label: t("app.navProgress"), Icon: Activity },
  { href: "/profile", label: t("app.navProfile"), Icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("app.navAria")}
      style={{
        position: "fixed",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "calc(var(--max-mobile) - 32px)",
        zIndex: 100,
        background: "var(--nav-glass-bg, rgba(255,255,255,0.82))",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderRadius: 22,
        border: "1px solid var(--nav-glass-border, rgba(255,255,255,0.5))",
        boxShadow: "0 4px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        display: "flex",
        padding: "6px 4px",
        paddingBottom: "calc(6px + var(--safe-bottom))",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: "8px 0",
              textDecoration: "none",
              color: active ? "var(--brand-600)" : "var(--neutral-400)",
              borderRadius: 16,
              background: active ? "var(--nav-active-bg, rgba(6,199,85,0.1))" : "transparent",
              transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              WebkitTapHighlightColor: "transparent",
              position: "relative",
            }}
          >
            <item.Icon
              size={22}
              strokeWidth={active ? 2.5 : 1.8}
              style={{
                transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                transform: active ? "scale(1.1)" : "scale(1)",
              }}
            />
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.01em",
                transition: "all 0.2s ease",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
