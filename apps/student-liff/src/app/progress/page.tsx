export default function ProgressPage() {
  const stats = {
    articlesRead: 7,
    totalArticles: 14,
    weekStreak: 3,
    totalMinutes: 210,
    level: "Origins 2",
    cefr: "A1",
    seriesColor: "#06c755",
    nextMilestone: { label: "Quest 4", at: 14, reward: "🏅 Origins Graduate" },
  };

  const progressPct = Math.round((stats.articlesRead / stats.totalArticles) * 100);

  const weeklyActivity = [
    { day: "จ", minutes: 20, active: true },
    { day: "อ", minutes: 0, active: false },
    { day: "พ", minutes: 35, active: true },
    { day: "พฤ", minutes: 15, active: true },
    { day: "ศ", minutes: 0, active: false },
    { day: "ส", minutes: 45, active: true },
    { day: "อา", minutes: 0, active: false },
  ];

  const maxMin = Math.max(...weeklyActivity.map((d) => d.minutes));

  const articles = [
    { id: "art-1", no: 1, title: "Hello, World!", done: true, minutes: 18 },
    { id: "art-2", no: 2, title: "My Family", done: true, minutes: 22 },
    { id: "art-3", no: 3, title: "At the Market", done: true, minutes: 15 },
    { id: "art-4", no: 4, title: "The Magic Garden", done: true, minutes: 30 },
    { id: "art-5", no: 5, title: "School Days", done: true, minutes: 25 },
    { id: "art-6", no: 6, title: "Rainy Season", done: true, minutes: 20 },
    { id: "art-7", no: 7, title: "Thai Festivals", done: true, minutes: 40 },
    { id: "art-8", no: 8, title: "Food Around Town", done: false, minutes: 0 },
    { id: "art-9", no: 9, title: "At the Hospital", done: false, minutes: 0 },
    { id: "art-10", no: 10, title: "The River City", done: false, minutes: 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="top-bar">
        <h1 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--neutral-900)", flex: 1 }}>
          ความก้าวหน้า
        </h1>
        <span className="badge badge-success">{stats.level} · {stats.cefr}</span>
      </div>

      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Main progress card */}
        <div
          className="card"
          style={{
            background: `linear-gradient(135deg, ${stats.seriesColor} 0%, #047d36 100%)`,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div aria-hidden style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div style={{ padding: "20px" }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8125rem", marginBottom: 4 }}>
              ระดับปัจจุบัน
            </p>
            <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 16 }}>
              {stats.level}
            </h2>

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8125rem" }}>
                  {stats.articlesRead} จาก {stats.totalArticles} บท
                </span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.875rem" }}>
                  {progressPct}%
                </span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.2)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "#fff",
                    borderRadius: "var(--radius-full)",
                    transition: "width var(--duration-slow)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span style={{ fontSize: "1rem" }}>🎯</span>
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.8125rem" }}>
                อีก <strong>{stats.nextMilestone.at - stats.articlesRead} บท</strong> รับ {stats.nextMilestone.reward}
              </span>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { icon: "🔥", label: "สตรีค", value: `${stats.weekStreak} สัปดาห์` },
            { icon: "⏱️", label: "เวลาเรียน", value: `${stats.totalMinutes} นาที` },
            { icon: "📖", label: "บทสำเร็จ", value: `${stats.articlesRead} บท` },
          ].map((s) => (
            <div
              key={s.label}
              className="card card-padded"
              style={{ textAlign: "center", padding: "14px 10px" }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--neutral-900)", lineHeight: 1.2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Weekly activity chart */}
        <div className="card card-padded">
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 16 }}>
            กิจกรรมสัปดาห์นี้
          </h3>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
            {weeklyActivity.map((d) => (
              <div
                key={d.day}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: maxMin > 0 && d.minutes > 0 ? `${(d.minutes / maxMin) * 60}px` : "6px",
                    background: d.active ? "var(--brand-500)" : "var(--neutral-200)",
                    borderRadius: "var(--radius-sm)",
                    transition: "height var(--duration-slow) var(--ease-smooth)",
                    minHeight: 6,
                  }}
                />
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: d.active ? 700 : 400,
                    color: d.active ? "var(--brand-600)" : "var(--neutral-400)",
                  }}
                >
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Article list */}
        <div>
          <div className="section-header">
            <h3 className="section-title">บทเรียนทั้งหมด</h3>
            <span className="badge badge-neutral">
              {stats.articlesRead}/{stats.totalArticles}
            </span>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            {articles.map((art, idx) => (
              <div
                key={art.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  borderTop: idx > 0 ? "1px solid var(--neutral-100)" : "none",
                  opacity: art.done ? 1 : 0.6,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: art.done ? "var(--brand-100)" : "var(--neutral-100)",
                    border: `2px solid ${art.done ? "var(--brand-400)" : "var(--neutral-200)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {art.done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand-600)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--neutral-400)" }}>
                      {art.no}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: art.done ? "var(--neutral-900)" : "var(--neutral-500)",
                    }}
                    className="text-ellipsis"
                  >
                    {art.title}
                  </div>
                  {art.done && (
                    <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 2 }}>
                      ⏱ {art.minutes} นาที
                    </div>
                  )}
                </div>
                {art.done ? (
                  <span className="badge badge-success" style={{ fontSize: "0.6875rem", padding: "2px 8px" }}>เสร็จ</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neutral-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
