import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { BadgePercent, Coins, Network, Wallet } from "lucide-react";
import {
  CardHeader,
  Chip,
  DataTable,
  EmptyState,
  Grid,
  Page,
  PageHeader,
  ProgressBar,
  Section,
  StatCard,
  StatusChip,
  Surface,
  type DataTableColumn,
  type Tone,
} from "@/components/app";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { formatNumber, formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { cn } from "@/lib/utils";
import {
  EMPTY_PROJECTION,
  EMPTY_RATE_INFO,
  adjustmentLines,
  canOfferTawi50,
  commissionPercent,
  formatPeriodMonth,
  historyGross,
  historyNetTotal,
  projectWithholding,
  rateProgressPercent,
  type EarningsHistoryItem,
  type EarningsResponse,
} from "./lib/earnings";
import { SalesCsvDownloadButton } from "./sales-csv-download-button";
import { Tawi50DownloadButton } from "./tawi50-download-button";
import { TransferStatusBadge, TransferStatusProvider } from "./transfer-status-badge";

type TutorProfile = {
  verificationStatus?: string;
  settings?: {
    taxName?: string;
    nationalId?: string;
    address?: string;
    verification?: Record<string, { status?: string; comment?: string }>;
  };
};

async function getEarningsHistoryData(token: string): Promise<EarningsResponse | null> {
  if (!token) return null;

  const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
  const res = await fetch(`${baseUrl}/v1/tutors/earnings/history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

const payoutStatus: Record<string, { label: string; tone: Tone }> = {
  draft: { label: t("dashboardEarnings.statuses.draft"), tone: "neutral" },
  pending: { label: t("dashboardEarnings.statuses.pending"), tone: "warning" },
  approved: { label: t("dashboardEarnings.statuses.approved"), tone: "success" },
  rejected: { label: t("dashboardEarnings.statuses.rejected"), tone: "danger" },
};

const money = (value: number, signed = false) => formatTHB(value, { fractionDigits: 2, signed });

/** One label/amount line of a breakdown. */
function AmountRow({
  label,
  value,
  tone = "default",
  strong,
}: {
  label: ReactNode;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", strong && "py-2.5")}>
      <dt className={cn("min-w-0 text-sm", strong ? "font-semibold text-fg" : "text-fg-muted")}>{label}</dt>
      <dd
        className={cn(
          "shrink-0 tabular",
          strong ? "text-base font-bold" : "text-sm font-medium",
          tone === "positive" && "text-success-fg",
          tone === "negative" && "text-danger-fg",
          tone === "muted" && "text-fg-muted",
          tone === "default" && "text-fg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function AdjustmentList({ item }: { item: EarningsHistoryItem }) {
  const lines = adjustmentLines(item, t("dashboardEarnings.clawback"));
  if (lines.length === 0) return <span className="text-fg-subtle">–</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {lines.map((adj, i) => (
        <li key={i} className="min-w-0">
          <span className={cn("font-medium tabular", adj.amount < 0 ? "text-danger-fg" : "text-success-fg")}>
            {money(adj.amount, true)}
          </span>
          <span className="block truncate text-xs text-fg-muted" title={adj.reason}>
            {adj.reason}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BonusCell({ item }: { item: EarningsHistoryItem }) {
  const badge = item.badgeBonus ?? 0;
  if (item.network === 0 && badge === 0) return <span className="text-fg-subtle">–</span>;
  return (
    <div className="flex flex-col items-start gap-0.5 whitespace-nowrap lg:items-end">
      {item.network !== 0 ? <span className="text-success-fg">{money(item.network, true)}</span> : null}
      {badge !== 0 ? (
        <span className="text-xs text-fg-muted">
          Badge <span className="text-success-fg">{money(badge, true)}</span>
        </span>
      ) : null}
    </div>
  );
}

export default async function EarningsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  // The session (identity /users/me) is memoised per request: the layout already loaded it.
  const [response, session] = await Promise.all([getEarningsHistoryData(token), getActiveTutorSession()]);
  const user = (session?.user ?? null) as TutorProfile | null;

  const earnings = response?.currentProjection || EMPTY_PROJECTION;
  const history = response?.history || [];
  const rateInfo = response?.rateInfo || EMPTY_RATE_INFO;
  const periodMonth = response?.periodMonth || "";
  const periodLabel = formatPeriodMonth(periodMonth) || "–";

  const projection = projectWithholding(earnings.total);
  const ratePercent = commissionPercent(rateInfo.rate);
  const progressPercent = rateProgressPercent(rateInfo);
  const projectionAdjustments = adjustmentLines(earnings, t("dashboardEarnings.clawback"));
  const badgeBonus = earnings.badgeBonus ?? 0;

  const isVerified = user?.verificationStatus === "VERIFIED";
  const transferRows = history
    .filter((item) => item.payoutLineId && item.payoutDocument?.transferStatus)
    .map((item) => ({
      payoutLineId: item.payoutLineId as string,
      status: item.payoutDocument?.transferStatus as string,
      transferredAt: item.payoutDocument?.transferredAt ?? null,
    }));

  const columns: DataTableColumn<EarningsHistoryItem>[] = [
    {
      key: "period",
      header: t("dashboardEarnings.columns.period"),
      mobile: "primary",
      cell: (item) => (
        <span className="flex flex-col">
          <span className="font-medium whitespace-nowrap text-fg">{formatPeriodMonth(item.date)}</span>
          {item.payoutDocument ? (
            <span
              className="text-xs font-normal whitespace-nowrap text-fg-muted"
              title={`${t("dashboardEarnings.documentPrefix")} ${item.payoutDocument.documentNumber}`}
            >
              {item.payoutDocument.documentNumber}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "commission",
      header: t("dashboardEarnings.columns.commission"),
      align: "right",
      cell: (item) => <span className="whitespace-nowrap">{money(item.direct)}</span>,
    },
    {
      key: "bonus",
      header: t("dashboardEarnings.columns.bonus"),
      align: "right",
      cell: (item) => <BonusCell item={item} />,
    },
    {
      key: "adjustments",
      header: t("dashboardEarnings.columns.adjustments"),
      className: "max-w-40",
      cell: (item) => <AdjustmentList item={item} />,
    },
    {
      key: "gross",
      header: t("dashboardEarnings.columns.gross"),
      align: "right",
      cell: (item) => <span className="whitespace-nowrap">{money(historyGross(item))}</span>,
    },
    {
      key: "net",
      header: t("dashboardEarnings.columns.net"),
      align: "right",
      mobile: "trailing",
      cell: (item) => (
        <span className="flex flex-col items-end whitespace-nowrap">
          <span className="font-semibold text-fg">{money(historyNetTotal(item))}</span>
          {item.withholdingTax !== undefined && item.withholdingTax > 0 ? (
            <span className="text-xs font-normal text-fg-muted">
              {t("dashboardEarnings.columns.wht")} <span className="text-danger-fg">{money(-item.withholdingTax)}</span>
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: t("dashboardEarnings.columns.status"),
      mobile: "trailing",
      cell: (item) => {
        const status = payoutStatus[item.status];
        return (
          <div className="flex flex-col items-end gap-1 lg:items-start">
            <StatusChip status={item.status} tone={status?.tone ?? "neutral"} label={status?.label ?? item.status} size="sm" />
            {item.payoutLineId && item.payoutDocument?.transferStatus ? (
              <TransferStatusBadge payoutLineId={item.payoutLineId} />
            ) : null}
          </div>
        );
      },
    },
    {
      key: "download",
      header: t("dashboardEarnings.columns.document"),
      cell: (item) =>
        item.payoutDocument && canOfferTawi50(item) ? (
          <Tawi50DownloadButton
            href={`/api/documents/tawi50?payoutDocumentId=${encodeURIComponent(item.payoutDocument.payoutDocumentId)}`}
            filename={`tawi50-${item.payoutDocument.documentNumber}.pdf`}
            settings={user?.settings ?? null}
            isVerified={isVerified}
          />
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
    },
  ];

  return (
    <Page>
      <VerificationBanner user={user ?? undefined} />
      <PageHeader
        title={t("dashboardEarnings.title")}
        description={t("dashboardEarnings.pageDescription")}
        actions={<SalesCsvDownloadButton periodMonth={periodMonth} label={t("dashboardEarnings.downloadCsv")} />}
      />

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("dashboardEarnings.stats.netEstimate")}
          value={money(projection.net)}
          icon={Wallet}
          tone="brand"
          hint={t("dashboardEarnings.stats.afterWHT")}
        />
        <StatCard
          label={t("dashboardEarnings.stats.direct")}
          value={money(earnings.directSales)}
          icon={Coins}
          tone="brand"
          hint={periodLabel}
        />
        <StatCard
          label={t("dashboardEarnings.stats.network")}
          value={money(earnings.networkBonus, true)}
          icon={Network}
          tone="teal"
          hint={badgeBonus > 0 ? `${t("dashboardEarnings.stats.badgeBonusHint")} ${money(badgeBonus, true)}` : periodLabel}
        />
        <StatCard
          label={t("dashboardEarnings.stats.rate")}
          value={`${formatNumber(ratePercent, Number.isInteger(ratePercent) ? 0 : 2)}%`}
          icon={BadgePercent}
          tone="orange"
          hint={
            rateInfo.nextTarget > 0
              ? `${t("dashboardEarnings.rateTargetPrefix")} ${formatTHB(rateInfo.nextTarget, { fractionDigits: 0 })}`
              : t("dashboardEarnings.maxRate")
          }
        />
      </Grid>

      <Grid cols={2} className="items-start">
        <Surface padding="lg">
          <CardHeader
            title={t("dashboardEarnings.projectionTitle")}
            description={t("dashboardEarnings.projectionWHTNote")}
            action={<Chip tone="neutral">{periodLabel}</Chip>}
          />
          <dl className="mt-3 divide-y divide-hairline">
            <AmountRow label={t("dashboardEarnings.directCommission")} value={money(earnings.directSales)} />
            <AmountRow label={t("dashboardEarnings.networkBonus")} value={money(earnings.networkBonus, true)} tone="positive" />
            {badgeBonus > 0 ? (
              <AmountRow label={t("dashboardEarnings.badgeBonus")} value={money(badgeBonus, true)} tone="positive" />
            ) : null}
            {projectionAdjustments.map((adj, i) => (
              <AmountRow
                key={`adj-${i}`}
                label={adj.reason}
                value={money(adj.amount, true)}
                tone={adj.amount < 0 ? "negative" : "positive"}
              />
            ))}
            <AmountRow label={t("dashboardEarnings.grossBeforeWHT")} value={money(projection.gross)} />
            {projection.wht > 0 ? (
              <AmountRow
                label={t("dashboardEarnings.withholdingTaxEstimated")}
                value={money(-projection.wht)}
                tone="negative"
              />
            ) : null}
            <AmountRow label={t("dashboardEarnings.estimatedNetPayout")} value={money(projection.net)} strong />
          </dl>
        </Surface>

        <Surface padding="lg">
          <CardHeader
            title={t("dashboardEarnings.rateTitle")}
            description={t("dashboardEarnings.currentCommission")}
            action={
              <span className="text-2xl font-bold text-brand-fg tabular">
                {formatNumber(ratePercent, Number.isInteger(ratePercent) ? 0 : 2)}%
              </span>
            }
          />
          <div className="mt-5 flex flex-col gap-2">
            <ProgressBar value={progressPercent} label={t("dashboardEarnings.rateTitle")} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[0.8125rem] text-fg-muted">
              <span>
                {t("dashboardEarnings.rateVolume")}{" "}
                <span className="font-semibold text-fg tabular">{formatTHB(rateInfo.volume, { fractionDigits: 0 })}</span>
              </span>
              <span>
                {rateInfo.nextTarget > 0
                  ? `${t("dashboardEarnings.rateTargetPrefix")} ${formatTHB(rateInfo.nextTarget, { fractionDigits: 0 })} ${t("dashboardEarnings.rateTargetSuffix")}`
                  : t("dashboardEarnings.maxRate")}
              </span>
            </div>
          </div>
        </Surface>
      </Grid>

      <Section
        title={t("dashboardEarnings.payoutHistory")}
        description={history.length > 0 ? t("dashboardEarnings.historyDescription") : undefined}
      >
        <TransferStatusProvider initial={transferRows}>
          <DataTable
            caption={t("dashboardEarnings.payoutHistory")}
            columns={columns}
            rows={history}
            breakpoint="lg"
            dense
            getRowKey={(item) => `${item.date}-${item.status}-${item.payoutLineId ?? ""}`}
            empty={
              <EmptyState
                icon={Wallet}
                tone="brand"
                title={t("dashboardEarnings.emptyPayoutHistory")}
                description={t("dashboardEarnings.emptyPayoutHistoryDescription")}
              />
            }
          />
        </TransferStatusProvider>
      </Section>
    </Page>
  );
}
