"use client";

import { AudioLines, Check, FileX2, Mic, Minus, PlugZap, Unplug } from "lucide-react";
import {
  Card,
  CardHeader,
  CardSkeleton,
  Chip,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  IdCell,
  KpiStrip,
  LoadingAnnouncement,
  Page,
  PageHeader,
  Section,
  SegmentedControl,
  StatCard,
  StatGridSkeleton,
  TableSkeleton,
  useAdminSession,
  type DataTableColumn,
  type StatBarSegment,
  type Tone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatPercent, formatThaiDate, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { voice } from "@/locales/th/voice";
import { focusWhenOrphaned } from "@/app/audit/_components/focusWhenOrphaned";

type Metrics = {
  attempts: number;
  started: number;
  failedStarts: number;
  failedStartRate: number;
  finished: number;
  disconnected: number;
  disconnectRate: number;
  summaryFailures: number;
  summaryFailureRate: number;
  measuredCostSessions: number;
  missingCostSessions: number;
  missingTranscriptionCostSessions: number;
  totalMeasuredCostUsd: number;
  totalMeasuredRealtimeCostUsd: number;
  totalMeasuredTranscriptionCostUsd: number;
  averageMeasuredCostUsd: number | null;
  recentSessions: Session[];
};

type Session = {
  sessionId: string;
  createdAt: string;
  status: string;
  endReason: string | null;
  consumedSeconds: number;
  summaryAvailable: boolean;
  measuredRealtimeCostUsd: number | null;
  measuredTranscriptionCostUsd: number | null;
  measuredCostUsd: number | null;
};

const DAYS = ["7", "30", "90"] as const;
type Days = (typeof DAYS)[number];
const STATUS_LABELS: Record<string, string> = voice.status;
const SAFETY_REASONS = new Set(["HARASSMENT_OR_HATE", "ILLICIT", "PERSONAL_DATA", "PROMPT_INJECTION", "SELF_HARM", "SEXUAL_CONTENT", "VIOLENCE"]);

/** USD with 4 decimals (provider costs are fractions of a cent per session). */
function usd(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `US$${formatNumber(value, 4)}` : t("voice.noData");
}

function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? t("voice.durationMinSec", { m, s: rest }) : t("voice.durationSec", { s: rest });
}

function sessionLabel(session: Session): { label: string; tone: Tone } {
  const code = session.endReason || session.status;
  if (session.endReason && SAFETY_REASONS.has(session.endReason)) return { label: STATUS_LABELS.SAFETY_STOP, tone: "danger" };
  const label = STATUS_LABELS[code] ?? STATUS_LABELS[session.status] ?? code;
  const tone: Tone =
    code === "PROVIDER_FAILED" || code === "CONNECTION_LOST" || code === "UNEXPECTED_ERROR" || code === "CONNECTION_TIMEOUT"
      ? "danger"
      : code === "ACTIVE"
        ? "info"
        : code === "LEASE_EXPIRED" || code === "NO_SPEECH" || code === "QUOTA_REACHED"
          ? "warning"
          : "success";
  return { label, tone };
}

/** Rate badge: <5% normal, <15% watch, otherwise high. */
function rateBadge(rate: number, total: number) {
  if (!total) return undefined;
  const tone: Tone = rate < 0.05 ? "success" : rate < 0.15 ? "warning" : "danger";
  const label = rate < 0.05 ? t("voice.rateGood") : rate < 0.15 ? t("voice.rateWatch") : t("voice.rateBad");
  return (
    <Chip tone={tone} size="sm" dot>
      {label}
    </Chip>
  );
}

/**
 * KPI micro-bar for a rate (bold graft): the filled share is the rate itself,
 * in the badge's tone. The bar is an image whose label gives the words.
 */
function rateBar(rate: number, total: number): StatBarSegment[] | undefined {
  if (!total) return undefined;
  const tone: StatBarSegment["tone"] = rate < 0.05 ? "brand" : rate < 0.15 ? "warning" : "danger";
  return [{ value: rate * 100, tone }];
}

function rateBarLabel(label: string, rate: number, total: number): string | undefined {
  return total ? `${label} ${formatPercent(rate, { fractionDigits: 1 })}` : undefined;
}

/** "สูงผิดปกติ" rates (15% and up) get the KPI risk edge and a danger numeral. */
function isHighRate(rate: number, total: number): boolean {
  return Boolean(total) && rate >= 0.15;
}

export default function VoiceOperationsPage() {
  const me = useAdminSession();
  const table = useTableState({ filterKeys: ["days"], defaultFilters: { days: "30" } });
  const days: Days = (DAYS as readonly string[]).includes(table.filters.days ?? "") ? (table.filters.days as Days) : "30";

  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    me ? `${me.userId}:voice-ops:${days}` : null,
    () => api.get<Metrics>("/v1/admin/voice-operations", { query: { days } }),
    { keepPreviousData: true },
  );

  const columns: DataTableColumn<Session>[] = [
    {
      key: "createdAt",
      header: t("voice.colTime"),
      mobile: "secondary",
      cell: (s) => (
        <span className="whitespace-nowrap tabular">
          <span className="text-fg">{formatThaiDate(s.createdAt, "short")}</span>{" "}
          <span className="text-fg-muted">{formatThaiTime(s.createdAt, { suffix: true })}</span>
        </span>
      ),
    },
    { key: "session", header: t("voice.colSession"), mobile: "primary", cell: (s) => <IdCell id={s.sessionId} /> },
    {
      key: "status",
      header: t("voice.colStatus"),
      mobile: "trailing",
      cell: (s) => {
        const meta = sessionLabel(s);
        return (
          <Chip tone={meta.tone} size="sm" dot>
            {meta.label}
          </Chip>
        );
      },
    },
    { key: "duration", header: t("voice.colDuration"), align: "right", cell: (s) => duration(s.consumedSeconds) },
    {
      key: "summary",
      header: t("voice.colSummary"),
      cell: (s) =>
        s.summaryAvailable ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg">
            <Check aria-hidden="true" className="size-4 text-success-fg" />
            {t("voice.summaryYes")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
            <Minus aria-hidden="true" className="size-4" />
            {t("voice.summaryNo")}
          </span>
        ),
    },
    {
      key: "cost",
      header: t("voice.colCost"),
      align: "right",
      cell: (s) => (
        <span
          title={t("voice.costTooltip", { realtime: usd(s.measuredRealtimeCostUsd), transcription: usd(s.measuredTranscriptionCostUsd) })}
        >
          {usd(s.measuredCostUsd)}
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title={t("voice.title")}
        description={t("voice.description")}
        actions={
          <SegmentedControl
            aria-label={t("voice.range")}
            items={[
              { value: "7", label: t("voice.days7") },
              { value: "30", label: t("voice.days30") },
              { value: "90", label: t("voice.days90") },
            ]}
            value={days}
            onValueChange={(value) => table.setFilter("days", value)}
          />
        }
      />

      {error && !data ? (
        <ErrorState
          description={errorMessage(error)}
          onRetry={refetch}
          digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined}
        />
      ) : !data ? (
        <>
          <LoadingAnnouncement />
          <StatGridSkeleton count={4} />
          <CardSkeleton lines={2} />
          <TableSkeleton columns={6} />
        </>
      ) : (
        <>
          <KpiStrip>
            <StatCard
              label={t("voice.failedStarts")}
              value={formatPercent(data.failedStartRate, { fractionDigits: 1 })}
              icon={PlugZap}
              tone="orange"
              badge={rateBadge(data.failedStartRate, data.attempts)}
              hint={t("voice.failedStartsHint", { count: formatNumber(data.failedStarts), total: formatNumber(data.attempts) })}
              bar={rateBar(data.failedStartRate, data.attempts)}
              barLabel={rateBarLabel(t("voice.failedStarts"), data.failedStartRate, data.attempts)}
              risk={isHighRate(data.failedStartRate, data.attempts)}
            />
            <StatCard
              label={t("voice.disconnects")}
              value={formatPercent(data.disconnectRate, { fractionDigits: 1 })}
              icon={Unplug}
              tone="red"
              badge={rateBadge(data.disconnectRate, data.finished)}
              hint={t("voice.disconnectsHint", { count: formatNumber(data.disconnected), total: formatNumber(data.finished) })}
              bar={rateBar(data.disconnectRate, data.finished)}
              barLabel={rateBarLabel(t("voice.disconnects"), data.disconnectRate, data.finished)}
              risk={isHighRate(data.disconnectRate, data.finished)}
            />
            <StatCard
              label={t("voice.summaryFailures")}
              value={formatPercent(data.summaryFailureRate, { fractionDigits: 1 })}
              icon={FileX2}
              tone="amber"
              badge={rateBadge(data.summaryFailureRate, data.finished)}
              hint={t("voice.summaryFailuresHint", { count: formatNumber(data.summaryFailures), total: formatNumber(data.finished) })}
              bar={rateBar(data.summaryFailureRate, data.finished)}
              barLabel={rateBarLabel(t("voice.summaryFailures"), data.summaryFailureRate, data.finished)}
              risk={isHighRate(data.summaryFailureRate, data.finished)}
            />
            <StatCard
              label={t("voice.costTotal")}
              value={usd(data.totalMeasuredCostUsd)}
              icon={AudioLines}
              tone="brand"
              hint={`${t("voice.costAverage")} ${usd(data.averageMeasuredCostUsd)}`}
            />
          </KpiStrip>

          <Card padding="lg">
            <CardHeader title={t("voice.costTitle")} description={t("voice.costNote")} />
            <DescriptionList
              columns={3}
              items={[
                { label: t("voice.costRealtime"), value: <span className="tabular">{usd(data.totalMeasuredRealtimeCostUsd)}</span> },
                {
                  label: t("voice.costTranscription"),
                  value: <span className="tabular">{usd(data.totalMeasuredTranscriptionCostUsd)}</span>,
                },
                { label: t("voice.costAverage"), value: <span className="tabular">{usd(data.averageMeasuredCostUsd)}</span> },
                {
                  label: t("voice.costCoverageLabel"),
                  value: [
                    t("voice.costCoverage", {
                      measured: formatNumber(data.measuredCostSessions),
                      missing: formatNumber(data.missingCostSessions),
                    }),
                    data.missingTranscriptionCostSessions
                      ? t("voice.costMissingTranscription", { count: formatNumber(data.missingTranscriptionCostSessions) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  wide: true,
                },
              ]}
            />
          </Card>

          <Section title={t("voice.recentTitle")}>
            <DataTable
              caption={t("voice.recentTitle")}
              columns={columns}
              rows={data.recentSessions}
              density="compact"
              getRowKey={(s) => s.sessionId}
              loading={isLoading || isValidating}
              empty={
                <EmptyState
                  as="h3"
                  icon={Mic}
                  title={t("voice.emptyTitle")}
                  description={t("voice.emptyHint")}
                  action={
                    days !== "90" ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          table.setFilter("days", "90");
                          // This button goes away with the 90-day view: focus moves to the period tabs.
                          focusWhenOrphaned(() =>
                            document.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${t("voice.range")}"] [aria-checked="true"]`),
                          );
                        }}
                      >
                        {t("voice.days90")}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </Section>
        </>
      )}
    </Page>
  );
}
