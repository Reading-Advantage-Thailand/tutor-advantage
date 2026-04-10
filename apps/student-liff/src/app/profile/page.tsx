import Link from "next/link";

export default function ProfilePage() {
  const student = {
    name: "สมชาย ใจดี",
    initials: "สช",
    lineId: "somchai.jaidee",
    joinedAt: "มีนาคม 2026",
    level: "Origins 2",
    cefr: "A1",
    isMinor: false,
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

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #06c755 0%, #047d36 100%)",
          padding: "28px 20px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div aria-hidden style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <h1 style={{ color: "#fff", fontSize: "1.0625rem", fontWeight: 700, marginBottom: 20 }}>
          โปรไฟล์
        </h1>
      </div>

      {/* Profile card pulls up over header */}
      <div style={{ padding: "0 16px", marginTop: -56 }}>
        <div
          className="card card-padded"
          style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}
        >
          <div
            className="avatar-initials avatar-xl"
            style={{
              background: "linear-gradient(135deg, #06c755, #047d36)",
              fontSize: "1.25rem",
              boxShadow: "var(--shadow-green)",
            }}
          >
            {student.initials}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 3 }}>
              {student.name}
            </h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="badge badge-success">{student.level} · {student.cefr}</span>
              {student.isMinor && (
                <span className="badge badge-warning">ผู้เยาว์</span>
              )}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 5 }}>
              LINE: {student.lineId} · เข้าร่วม {student.joinedAt}
            </div>
          </div>
        </div>
      </div>

      {/* Menu groups */}
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
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

            <div className="card" style={{ overflow: "hidden" }}>
              {group.items.map((item, idx) => (
                <Link
                  key={item.id}
                  id={item.id}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "15px 16px",
                    textDecoration: "none",
                    borderTop: idx > 0 ? "1px solid var(--neutral-100)" : "none",
                    transition: "background var(--duration-fast)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      background: "var(--neutral-100)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <span style={{ flex: 1, fontSize: "0.9375rem", fontWeight: 500, color: "var(--neutral-800)" }}>
                    {item.label}
                  </span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Danger zone */}
        <div className="card" style={{ overflow: "hidden" }}>
          <button
            id="btn-logout"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "15px 16px",
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-red-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flexShrink: 0,
              }}
            >
              🚪
            </div>
            <span style={{ flex: 1, fontSize: "0.9375rem", fontWeight: 500, color: "var(--accent-red)", textAlign: "left" }}>
              ออกจากระบบ
            </span>
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--neutral-400)", lineHeight: 1.6 }}>
          Tutor Advantage Thailand · v0.1.0<br />
          Protected by Omise · PDPA Compliant
        </p>
      </div>
    </div>
  );
}
