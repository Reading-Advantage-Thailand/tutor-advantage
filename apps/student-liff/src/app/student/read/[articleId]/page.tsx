import Link from "next/link";

interface PageProps {
  params: Promise<{ articleId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { articleId } = await params;
  return {
    title: `บทอ่าน ${articleId} — Tutor Advantage`,
    description: "อ่านบทความภาษาอังกฤษจากโปรแกรม Tutor Advantage",
  };
}

export default async function ArticleReaderPage({ params }: PageProps) {
  const { articleId } = await params;

  // Mock article — wire to legacy-bridge / learning-service
  const article = {
    id: articleId,
    title: "The Magic Garden",
    level: "A1",
    series: "Origins",
    levelNum: 2,
    wordCount: 142,
    readTimeMin: 3,
    content: `Once upon a time, there was a small garden behind a big house. The garden had many colorful flowers: red roses, yellow sunflowers, and purple lavender.

Every morning, a girl named Nong walked through the garden. She loved the smell of the flowers. She talked to them and gave them water.

One day, Nong found a small door in the garden wall. She opened the door and saw a magical place. There were giant butterflies, singing birds, and a rainbow waterfall.

Nong was not afraid. She smiled and said, "Hello, magic garden!"

The flowers smiled back. From that day on, Nong visited the magic garden every morning. The garden grew bigger and more beautiful.

The end.`,
    vocabulary: [
      { word: "garden", thai: "สวน", phonetic: "/ˈɡɑːrdən/" },
      { word: "colorful", thai: "มีสีสัน", phonetic: "/ˈkʌlərfəl/" },
      { word: "magical", thai: "มหัศจรรย์", phonetic: "/ˈmædʒɪkəl/" },
      { word: "butterfly", thai: "ผีเสื้อ", phonetic: "/ˈbʌtərflaɪ/" },
      { word: "rainbow", thai: "รุ้งกินน้ำ", phonetic: "/ˈreɪnboʊ/" },
    ],
    comprehensionQ: [
      { q: "ใครเดินผ่านสวนทุกเช้า?", a: "น้องนง (Nong)" },
      { q: "น้องนงพบอะไรในกำแพงสวน?", a: "ประตูเล็กๆ" },
    ],
  };

  return (
    <div className="page-shell">
      {/* Top bar */}
      <div className="top-bar">
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--neutral-100)",
            color: "var(--neutral-700)",
            textDecoration: "none",
            flexShrink: 0,
          }}
          aria-label="กลับ"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--neutral-900)" }} className="text-ellipsis">
            {article.title}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)" }}>
            {article.series} · Level {article.levelNum} · {article.level}
          </div>
        </div>
        <button
          id="btn-article-tts"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--brand-50)",
            border: "none",
            cursor: "pointer",
            color: "var(--brand-600)",
            flexShrink: 0,
          }}
          aria-label="ฟังเสียง"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20, paddingBottom: 32 }}>

        {/* Meta strip */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span className="badge badge-success">{article.level}</span>
          <span className="badge badge-neutral">⏱ {article.readTimeMin} นาที</span>
          <span className="badge badge-neutral">📝 {article.wordCount} คำ</span>
        </div>

        {/* Article body */}
        <div className="card card-padded">
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--neutral-900)",
              marginBottom: 16,
              lineHeight: 1.3,
            }}
          >
            {article.title}
          </h1>

          <div
            style={{
              fontSize: "1.0625rem",
              lineHeight: 1.9,
              color: "var(--neutral-800)",
              fontFamily: "var(--font-latin)",
            }}
          >
            {article.content.split("\n\n").map((para, i) => (
              <p key={i} style={{ marginBottom: i < article.content.split("\n\n").length - 1 ? 16 : 0 }}>
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Vocabulary */}
        <div>
          <h2
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--neutral-900)",
              marginBottom: 10,
            }}
          >
            คำศัพท์สำคัญ
          </h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {article.vocabulary.map((v, idx) => (
              <div
                key={v.word}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  borderTop: idx > 0 ? "1px solid var(--neutral-100)" : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-md)",
                    background: "var(--brand-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--neutral-900)", fontFamily: "var(--font-latin)" }}>
                    {v.word}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", fontFamily: "var(--font-latin)", marginTop: 1 }}>
                    {v.phonetic}
                  </div>
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--brand-700)" }}>
                  {v.thai}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comprehension */}
        <div>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", marginBottom: 10 }}>
            คำถามทบทวน
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {article.comprehensionQ.map((item, i) => (
              <div
                key={i}
                className="card card-padded"
                style={{ border: "1.5px solid var(--brand-100)" }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--brand-600)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  คำถาม {i + 1}
                </div>
                <p style={{ fontSize: "0.9375rem", color: "var(--neutral-800)", fontWeight: 500, marginBottom: 10 }}>
                  {item.q}
                </p>
                <details>
                  <summary
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--brand-600)",
                      fontWeight: 600,
                      cursor: "pointer",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    ดูเฉลย
                  </summary>
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "var(--brand-50)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.9375rem",
                      color: "var(--brand-800)",
                      fontWeight: 600,
                    }}
                  >
                    {item.a}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>

        {/* Mark complete */}
        <button
          id="btn-mark-complete"
          className="btn btn-primary btn-full btn-lg"
          style={{ borderRadius: "var(--radius-full)" }}
        >
          ✅ อ่านจบแล้ว — บันทึกความก้าวหน้า
        </button>
      </div>
    </div>
  );
}
