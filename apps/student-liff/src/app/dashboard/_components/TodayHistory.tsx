import { Chip, ListGroup, ListRow, SectionHeader } from "@/components/mobile";
import { RankBadge } from "@/components/lesson/RankBadge";
import type { LessonHistoryItem } from "@/lib/enrollmentStatus";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * Lessons played today (rank, score, time) as flat rows in one card; hidden on
 * days without any — the quick menu already links to the full history. Scores
 * sit in a small chip in the reading face (tabular), never Kodchasan in a row.
 * Server-compatible.
 */
export function TodayHistory({ items }: { items: LessonHistoryItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="today-history-title">
      <SectionHeader
        id="today-history-title"
        title={t("dashboard.todayHistory")}
        action={{ label: t("common.seeAll"), href: "/lesson/history" }}
      />
      <ListGroup>
        {items.map((item) => (
          <ListRow
            key={item.sessionId}
            href={`/lesson/history/${item.sessionId}`}
            leading={<RankBadge rank={item.rank} />}
            title={item.articleTitle}
            subtitle={`${t("dashboard.tutorPrefix")} ${item.tutorName} · ${formatThaiTime(item.date, { suffix: true })}`}
            trailing={
              <Chip tone="brand" className="tabular-nums">
                {item.score} {t("dashboard.pointsUnit")}
              </Chip>
            }
          />
        ))}
      </ListGroup>
    </section>
  );
}
