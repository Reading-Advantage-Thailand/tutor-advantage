"use client";

import Link from "next/link";
import { useLiff } from "@/components/providers/LiffProvider";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BookOpen, CreditCard, Calendar, Bell, Shield, Users, MessageCircle, FileText, ChevronRight, LogOut, Palette } from "lucide-react";
import { t } from "@/lib/i18n";
import { studentApi } from "@/lib/api";

export default function ProfilePage() {
  const { liff, profile, isReady } = useLiff();
  const router = useRouter();
  const [levelDisplay, setLevelDisplay] = useState("Origins 1");
  const [cefrDisplay, setCefrDisplay] = useState("A1");

  useEffect(() => {
    if (!isReady) return;
    studentApi.getDashboard()
      .then((data: { recentClasses?: Array<{ bookName?: string | null; seriesCefr?: string | null }> }) => {
        const primary = data?.recentClasses?.[0];
        if (primary?.bookName) setLevelDisplay(primary.bookName);
        if (primary?.seriesCefr) setCefrDisplay(primary.seriesCefr);
      })
      .catch(() => {
        // keep defaults on error
      });
  }, [isReady]);

  const student = {
    name: profile?.displayName || t("dashboard.loadingName"),
    avatar: profile?.pictureUrl || null,
    initials: profile?.displayName?.charAt(0) || "TA",
    userId: profile?.userId || "...",
    level: levelDisplay,
    cefr: cefrDisplay,
    isMinor: false,
  };


  const handleLogout = () => {
    if (liff && liff.isLoggedIn()) {
      liff.logout();
      router.push("/");
    }
  };

  const menuGroups = [
    {
      title: t("profile.learning"),
      items: [
        { id: "menu-my-classes", Icon: BookOpen, label: t("profile.myClasses"), href: "/classes", iconBg: "var(--brand-50)", iconColor: "var(--brand-600)" },
        { id: "menu-payment-history", Icon: CreditCard, label: t("profile.paymentHistory"), href: "/payment/history", iconBg: "var(--accent-amber-light)", iconColor: "var(--accent-amber)" },
        { id: "menu-schedule", Icon: Calendar, label: t("profile.schedule"), href: "/schedule", iconBg: "var(--accent-purple-light)", iconColor: "var(--accent-purple)" },
      ],
    },
    {
      title: t("profile.account"),
      items: [
        { id: "menu-notifications", Icon: Bell, label: t("profile.notifications"), href: "/notifications", iconBg: "var(--accent-blue-light)", iconColor: "var(--accent-blue)" },
        { id: "menu-consent", Icon: Shield, label: t("profile.consent"), href: "/consent", iconBg: "rgba(16, 185, 129, 0.15)", iconColor: "rgb(16, 185, 129)" },
        { id: "menu-guardian", Icon: Users, label: t("profile.guardian"), href: "/guardian", iconBg: "rgba(236, 72, 153, 0.15)", iconColor: "rgb(236, 72, 153)" },
      ],
    },
    {
      title: t("profile.help"),
      items: [
        { id: "menu-contact", Icon: MessageCircle, label: t("profile.contactTeam"), href: "https://lin.ee/zqTz6feg", iconBg: "rgba(99, 102, 241, 0.15)", iconColor: "rgb(99, 102, 241)" },
        { id: "menu-terms", Icon: FileText, label: t("profile.terms"), href: "/terms", iconBg: "var(--neutral-100)", iconColor: "var(--neutral-500)" },
        { id: "menu-privacy", Icon: Shield, label: t("profile.privacy"), href: "/privacy", iconBg: "var(--neutral-100)", iconColor: "var(--neutral-500)" },
      ],
    },
  ];

  if (!isReady) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: "3px solid var(--neutral-200)", borderTopColor: "var(--brand-500)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Header */}
      <div
        className="curved-bottom"
        style={{
          background: "linear-gradient(160deg, #06c755 0%, #049a42 40%, #037d36 100%)",
          padding: "48px 20px 40px",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        <h1 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, position: "absolute", top: 20, left: 20, opacity: 0.9 }}>{t("profile.title")}</h1>

        {/* Avatar with gradient ring */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ position: "absolute", inset: -4, borderRadius: "50%", background: "linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))", filter: "blur(1px)" }} />
          <Avatar className="w-24 h-24 border-4 border-white/30 shadow-xl relative">
            {student.avatar && <AvatarImage src={student.avatar} alt={student.name} className="object-cover" />}
            <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">{student.initials}</AvatarFallback>
          </Avatar>
        </div>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.01em" }}>
          {student.name}
        </h2>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 600, backdropFilter: "blur(4px)" }}>
            {student.level} / {student.cefr}
          </div>
          {student.isMinor && (
            <div style={{ background: "var(--accent-amber-light)", color: "#92400e", padding: "4px 12px", borderRadius: 14, fontSize: "0.75rem", fontWeight: 600 }}>
              {t("profile.minor")}
            </div>
          )}
        </div>

        <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
          UID: {student.userId.substring(0, 15)}...
        </div>
      </div>

      {/* Theme toggle section */}
      <div style={{ padding: "20px 16px 0" }}>
        <Card className="glass-card overflow-hidden" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-amber-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Palette size={18} style={{ color: "var(--accent-amber)" }} />
            </div>
            <span style={{ flex: 1, fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("profile.theme")}</span>
            <ThemeToggle size={16} />
          </div>
        </Card>
      </div>

      {/* Menu groups */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {menuGroups.map((group) => (
          <div key={group.title}>
            <h3 style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingLeft: 4 }}>
              {group.title}
            </h3>

            <Card className="glass-card overflow-hidden">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {group.items.map((item, idx) => (
                  <div key={item.id}>
                    {idx > 0 && <Separator style={{ background: "var(--surface-border)" }} />}
                    <Link
                      id={item.id}
                      href={item.href}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textDecoration: "none", transition: "background 0.15s ease" }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: item.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <item.Icon size={18} style={{ color: item.iconColor }} />
                      </div>
                      <span style={{ flex: 1, fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
                      <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))}

        {/* Logout */}
        <Card className="glass-card overflow-hidden">
          <Button
            variant="ghost"
            id="btn-logout"
            onClick={handleLogout}
            className="w-full justify-start h-auto rounded-none hover:bg-red-50/10 text-red-600 hover:text-red-700 focus-visible:ring-red-500"
            style={{ padding: "18px 20px" }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-red-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 12 }}>
              <LogOut size={18} style={{ color: "var(--accent-red)" }} />
            </div>
            <span style={{ fontSize: "0.9375rem", fontWeight: 500 }}>{t("profile.logout")}</span>
          </Button>
        </Card>

        <p style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--text-tertiary)", lineHeight: 1.6, paddingBottom: 8 }}>
          {t("profile.footer")}<br />
          {t("profile.compliance")}
        </p>
      </div>
    </div>
  );
}
