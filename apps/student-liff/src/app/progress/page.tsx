import { Flame, Clock, BookOpen, Target, Lock, CheckCircle2 } from "lucide-react";

export default function ProgressPage() {
  const stats = {
    articlesRead: 7, totalArticles: 14, weekStreak: 3, totalMinutes: 210,
    level: "Origins 2", cefr: "A1", seriesColor: "#06c755",
    nextMilestone: { label: "Quest 4", at: 14, reward: "🏅 Origins Graduate" },
  };

  const progressPct = Math.round((stats.articlesRead / stats.totalArticles) * 100);

  const weeklyActivity = [
    { day: "จ", minutes: 20, active: true }, { day: "อ", minutes: 0, active: false },
    { day: "พ", minutes: 35, active: true }, { day: "พฤ", minutes: 15, active: true },
    { day: "ศ", minutes: 0, active: false }, { day: "ส", minutes: 45, active: true },
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
      <div className="top-bar" style={{ background: "var(--surface-card)", backdropFilter: "blur(12px)" }}>
        <h1 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>ความก้าวหน้า</h1>
        <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", padding: "5px 12px", borderRadius: "var(--radius-full)", fontSize: "0.75rem", fontWeight: 700, border: "1px solid var(--brand-100)" }}>
          {stats.level} · {stats.cefr}
        </span>
      </div>

      <div style={{ padding: "16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Main progress card */}
        <div className="curved-bottom" style={{ background: `linear-gradient(135deg, ${stats.seriesColor} 0%, #037d36 100%)`, borderRadius: 24, overflow: "hidden", position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ padding: "24px 20px" }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.75rem", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>ระดับปัจจุบัน</p>
            <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 20 }}>{stats.level}</h2>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem" }}>{stats.articlesRead} จาก {stats.totalArticles} บท</span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.875rem" }}>{progressPct}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.15)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #fff, #bbf7d0)", borderRadius: 20, transition: "width 0.6s ease", boxShadow: "0 0 10px rgba(255,255,255,0.3)" }} />
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.15)" }}>
              <Target size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8125rem" }}>
                อีก <strong>{stats.nextMilestone.at - stats.articlesRead} บท</strong> รับ {stats.nextMilestone.reward}
              </span>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { Icon: Flame, label: "สตรีค", value: `${stats.weekStreak} สัปดาห์`, bgColor: "var(--accent-amber-light)", iconColor: "var(--accent-amber)" },
            { Icon: Clock, label: "เวลาเรียน", value: `${stats.totalMinutes} นาที`, bgColor: "var(--accent-blue-light)", iconColor: "var(--accent-blue)" },
            { Icon: BookOpen, label: "บทสำเร็จ", value: `${stats.articlesRead} บท`, bgColor: "var(--brand-50)", iconColor: "var(--brand-600)" },
          ].map((s) => (
            <div key={s.label} className="glass-card" style={{ textAlign: "center", padding: "16px 10px", background: s.bgColor, border: "1px solid var(--surface-border)" }}>
              <s.Icon size={20} style={{ color: s.iconColor, marginBottom: 6, marginInline: "auto" }} />
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Weekly chart */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>กิจกรรมสัปดาห์นี้</h3>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>
            {weeklyActivity.map((d) => (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: "100%",
                  height: maxMin > 0 && d.minutes > 0 ? `${(d.minutes / maxMin) * 60}px` : "5px",
                  background: d.active ? `linear-gradient(180deg, ${stats.seriesColor}, #34d399)` : "var(--neutral-200)",
                  borderRadius: 6,
                  transition: "height 0.5s ease",
                  minHeight: 5,
                  boxShadow: d.active ? "0 2px 6px rgba(6,199,85,0.2)" : "none",
                }} />
                <span style={{ fontSize: "0.625rem", fontWeight: d.active ? 700 : 400, color: d.active ? "var(--brand-600)" : "var(--text-tertiary)" }}>
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
            <span style={{ background: "var(--neutral-100)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "0.6875rem", fontWeight: 700 }}>
              {stats.articlesRead}/{stats.totalArticles}
            </span>
          </div>

          <div className="glass-card" style={{ overflow: "hidden" }}>
            {articles.map((art, idx) => (
              <div
                key={art.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                  borderTop: idx > 0 ? "1px solid var(--surface-border)" : "none",
                  opacity: art.done ? 1 : 0.55,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: art.done ? "var(--brand-100)" : "var(--neutral-100)",
                  border: `2px solid ${art.done ? "var(--brand-400)" : "var(--neutral-200)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {art.done ? (
                    <CheckCircle2 size={14} style={{ color: "var(--brand-600)" }} />
                  ) : (
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--text-tertiary)" }}>{art.no}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: art.done ? "var(--text-primary)" : "var(--text-tertiary)" }} className="text-ellipsis">
                    {art.title}
                  </div>
                  {art.done && (
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} /> {art.minutes} นาที
                    </div>
                  )}
                </div>
                {art.done ? (
                  <span style={{ background: "var(--brand-50)", color: "var(--brand-700)", fontSize: "0.625rem", fontWeight: 700, padding: "3px 8px", borderRadius: 8 }}>เสร็จ</span>
                ) : (
                  <Lock size={14} style={{ color: "var(--neutral-300)" }} />
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
