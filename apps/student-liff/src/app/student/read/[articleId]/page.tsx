import Link from "next/link";
import { studentReadMockArticle, t } from "@/lib/i18n";

interface PageProps {
  params: Promise<{ articleId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { articleId } = await params;
  return {
    title: `${t("articleReader.metadataTitlePrefix")} ${articleId} - Tutor Advantage`,
    description: t("articleReader.metadataDescription"),
  };
}

export default async function ArticleReaderPage({ params }: PageProps) {
  const { articleId } = await params;

  const article = {
    id: articleId,
    ...studentReadMockArticle,
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
          aria-label={t("articleReader.back")}
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
            {article.series} / {t("articleReader.levelLabel")} {article.levelNum} / {article.level}
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
          aria-label={t("articleReader.listen")}
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
          <span className="badge badge-neutral">{article.readTimeMin} {t("articleReader.minuteUnit")}</span>
          <span className="badge badge-neutral">{article.wordCount} {t("articleReader.wordUnit")}</span>
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
            {t("articleReader.vocabularyTitle")}
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
            {t("articleReader.comprehensionTitle")}
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
                  {t("articleReader.questionPrefix")} {i + 1}
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
                    {t("articleReader.showAnswer")}
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
          {t("articleReader.completeCta")}
        </button>
      </div>
    </div>
  );
}
