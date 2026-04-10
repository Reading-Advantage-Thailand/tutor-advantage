export default function ClassesPage() {
  const classes = [
    {
      id: "cls-001",
      name: "Origins 2 — กลุ่มวันเสาร์",
      tutor: "อ.นภา สุขใส",
      tutorInitials: "นภ",
      series: "Origins",
      cefr: "A1",
      level: 2,
      seriesColor: "#06c755",
      status: "open" as const,
      enrolled: 4,
      capacity: 6,
      price: 2800,
      nextSession: "เสาร์ 12 เม.ย. · 10:00",
      articles: 14,
    },
    {
      id: "cls-002",
      name: "Quest 4 — กลุ่มวันอาทิตย์บ่าย",
      tutor: "อ.ธีรพล มั่นคง",
      tutorInitials: "ธพ",
      series: "Quest",
      cefr: "A2",
      level: 4,
      seriesColor: "#3b82f6",
      status: "open" as const,
      enrolled: 3,
      capacity: 6,
      price: 2900,
      nextSession: "อา. 13 เม.ย. · 13:00",
      articles: 14,
    },
    {
      id: "cls-003",
      name: "Origins 1 — กลุ่มวันจันทร์",
      tutor: "อ.นภา สุขใส",
      tutorInitials: "นภ",
      series: "Origins",
      cefr: "A1",
      level: 1,
      seriesColor: "#06c755",
      status: "full" as const,
      enrolled: 6,
      capacity: 6,
      price: 2800,
      nextSession: "จ. 14 เม.ย. · 17:00",
      articles: 14,
    },
  ];

  const statusMap = {
    open: { label: "รับสมัคร", className: "status-active" },
    full: { label: "เต็มแล้ว", className: "status-full" },
    closed: { label: "ปิดรับ", className: "status-closed" },
  };

  return (
    <div>
      {/* Header */}
      <div className="top-bar">
        <h1 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--neutral-900)", flex: 1 }}>
          คลาสเรียน
        </h1>
        <button
          id="btn-filter-classes"
          style={{
            background: "var(--neutral-100)",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--neutral-600)",
            fontFamily: "inherit",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          กรอง
        </button>
      </div>

      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--neutral-400)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="input-search-classes"
            type="search"
            placeholder="ค้นหาคลาสหรือติวเตอร์..."
            className="input-field"
            style={{ paddingLeft: 40 }}
          />
        </div>

        {/* Series filter chips */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {[
            { label: "ทั้งหมด", active: true },
            { label: "Origins A1", active: false },
            { label: "Quest A2", active: false },
            { label: "Adventure B1", active: false },
          ].map((chip, i) => (
            <button
              key={i}
              id={`chip-filter-${chip.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={chip.active ? "badge badge-success" : "badge badge-neutral"}
              style={{
                padding: "7px 14px",
                fontSize: "0.8125rem",
                whiteSpace: "nowrap",
                cursor: "pointer",
                border: chip.active ? "1.5px solid var(--brand-300)" : "1.5px solid var(--neutral-200)",
                fontFamily: "inherit",
                transition: "all var(--duration-fast)",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Class cards */}
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {classes.map((cls) => {
            const status = statusMap[cls.status];
            const fillPct = Math.round((cls.enrolled / cls.capacity) * 100);
            return (
              <a
                key={cls.id}
                href={`/classes/${cls.id}`}
                id={`class-card-${cls.id}`}
                className="card card-hover animate-slide-up"
                style={{ textDecoration: "none", display: "block", overflow: "hidden" }}
              >
                {/* Colored accent bar */}
                <div
                  style={{
                    height: 4,
                    background: cls.seriesColor,
                    opacity: cls.status === "full" ? 0.4 : 1,
                  }}
                />

                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2
                        className="line-clamp-2"
                        style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", lineHeight: 1.35 }}
                      >
                        {cls.name}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <div
                          className="avatar-initials"
                          style={{ width: 20, height: 20, fontSize: "0.625rem", borderRadius: "50%", background: cls.seriesColor + "22", color: cls.seriesColor }}
                        >
                          {cls.tutorInitials}
                        </div>
                        <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                          {cls.tutor}
                        </span>
                      </div>
                    </div>

                    <div className={`status-chip ${status.className}`} style={{ flexShrink: 0, fontSize: "0.75rem" }}>
                      {status.label}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 22,
                          height: 22,
                          borderRadius: "6px",
                          background: cls.seriesColor + "18",
                          fontSize: "0.625rem",
                          fontWeight: 800,
                          color: cls.seriesColor,
                        }}
                      >
                        {cls.cefr}
                      </span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", fontWeight: 500 }}>
                        {cls.series} Level {cls.level}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                        {cls.nextSession}
                      </span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                        ที่นั่ง: {cls.enrolled}/{cls.capacity} คน
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: cls.status === "full" ? "var(--accent-red)" : "var(--brand-600)",
                        }}
                      >
                        {cls.capacity - cls.enrolled} ที่ว่าง
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${fillPct}%`,
                          background: cls.status === "full"
                            ? "var(--accent-red)"
                            : `linear-gradient(90deg, ${cls.seriesColor}, ${cls.seriesColor}cc)`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Price + CTA */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--neutral-900)" }}>
                        ฿{cls.price.toLocaleString()}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginLeft: 4 }}>
                        / คอร์ส ({cls.articles} บท)
                      </span>
                    </div>

                    <div
                      className="btn btn-sm"
                      style={{
                        background: cls.status === "open" ? cls.seriesColor : "var(--neutral-200)",
                        color: cls.status === "open" ? "#fff" : "var(--neutral-400)",
                        borderRadius: "var(--radius-full)",
                        pointerEvents: cls.status === "full" ? "none" : "auto",
                        fontSize: "0.8125rem",
                        padding: "9px 18px",
                      }}
                    >
                      {cls.status === "open" ? "ดูรายละเอียด" : "เต็มแล้ว"}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Empty state hint */}
        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "var(--neutral-400)", padding: "8px 0 16px" }}>
          มีลิงก์จากติวเตอร์แล้ว?{" "}
          <a href="/login" style={{ color: "var(--brand-600)", fontWeight: 600, textDecoration: "none" }}>
            เข้าสู่ระบบเพื่อสมัคร →
          </a>
        </p>
      </div>
    </div>
  );
}
