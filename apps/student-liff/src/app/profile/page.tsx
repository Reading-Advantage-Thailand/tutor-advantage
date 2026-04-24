"use client";

import Link from "next/link";
import { useLiff } from "@/components/providers/LiffProvider";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { liff, profile, isReady } = useLiff();
  const router = useRouter();

  const student = {
    name: profile?.displayName || "กำลังโหลด...",
    avatar: profile?.pictureUrl || null,
    initials: profile?.displayName?.charAt(0) || "TA",
    userId: profile?.userId || "...",
    joinedAt: "มีนาคม 2026",
    level: "Origins 2",
    cefr: "A1",
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
      title: "การเรียน",
      items: [
        { id: "menu-my-classes", icon: "📚", label: "คลาสของฉัน", href: "/classes" },
        { id: "menu-payment-history", icon: "💳", label: "ประวัติการชำระเงิน", href: "/payment/history" },
        { id: "menu-schedule", icon: "🗓️", label: "ตารางเรียน", href: "/schedule" },
      ],
    },
    {
      title: "บัญชี",
      items: [
        { id: "menu-notifications", icon: "🔔", label: "การแจ้งเตือน", href: "/notifications" },
        { id: "menu-consent", icon: "🔏", label: "การยินยอมข้อมูล (PDPA)", href: "/consent" },
        { id: "menu-guardian", icon: "👪", label: "ข้อมูลผู้ปกครอง", href: "/guardian" },
      ],
    },
    {
      title: "ช่วยเหลือ",
      items: [
        { id: "menu-contact", icon: "💬", label: "ติดต่อทีมงาน", href: "#" },
        { id: "menu-terms", icon: "📄", label: "เงื่อนไขการใช้งาน", href: "/terms" },
        { id: "menu-privacy", icon: "🛡️", label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
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
    <div style={{ paddingBottom: "120px" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(160deg, #06c755 0%, #047d36 100%)",
          padding: "64px 20px 40px",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        
        <h1 style={{ color: "#fff", fontSize: "1.125rem", fontWeight: 700, position: "absolute", top: 24, left: 20 }}>
          โปรไฟล์
        </h1>

        <Avatar className="w-24 h-24 border-4 border-white shadow-lg mb-4">
          {student.avatar && <AvatarImage src={student.avatar} alt={student.name} className="object-cover" />}
          <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
            {student.initials}
          </AvatarFallback>
        </Avatar>

        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.01em" }}>
          {student.name}
        </h2>
        
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <Badge variant="outline" className="text-white border-white/30 bg-white/20 px-3 py-1 text-xs">
            {student.level} · {student.cefr}
          </Badge>
          {student.isMinor && (
            <Badge className="bg-yellow-200 text-yellow-900 hover:bg-yellow-300 px-3 py-1 text-xs border-none">
              ผู้เยาว์
            </Badge>
          )}
        </div>
        
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>
          UID: {student.userId.substring(0, 15)}...
        </div>
      </div>

      {/* Menu groups */}
      <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
        {menuGroups.map((group) => (
          <div key={group.title}>
            <h3
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--neutral-400)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 8,
                paddingLeft: 4,
              }}
            >
              {group.title}
            </h3>

            <Card className="overflow-hidden border-none shadow-sm">
              <div className="flex flex-col">
                {group.items.map((item, idx) => (
                  <div key={item.id}>
                    {idx > 0 && <Separator />}
                    <Link
                      id={item.id}
                      href={item.href}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center text-base shrink-0">
                        {item.icon}
                      </div>
                      <span className="flex-1 text-[15px] font-medium text-foreground">
                        {item.label}
                      </span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))}

        <Card className="overflow-hidden border-none shadow-sm">
          <Button
            variant="ghost"
            id="btn-logout"
            onClick={handleLogout}
            className="w-full justify-start h-auto p-4 rounded-none hover:bg-red-50 text-red-600 hover:text-red-700 focus-visible:ring-red-500"
          >
            <div className="w-9 h-9 rounded-md bg-red-100 flex items-center justify-center shrink-0 mr-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <span className="text-[15px] font-medium">ออกจากระบบ</span>
          </Button>
        </Card>

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--neutral-400)", lineHeight: 1.6 }}>
          Tutor Advantage Thailand · v0.1.0<br />
          Protected by Omise · PDPA Compliant
        </p>
      </div>
    </div>
  );
}
