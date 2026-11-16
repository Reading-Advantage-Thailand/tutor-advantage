import type { ReactNode } from "react";
import { ShieldCheck, Wallet } from "lucide-react";
import {
  Chip,
  DataTable,
  EmptyState,
  Notice,
  Page,
  PageHeader,
  Section,
  StatStrip,
  StatusChip,
  Surface,
  WalletHero,
  type DataTableColumn,
  type Tone,
} from "@/components/app";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { formatNumber, formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PAYOUT_POLICY,
  EMPTY_PROJECTION,
  EMPTY_RATE_INFO,
  adjustmentLines,
  type AdjustmentReasonLabels,
  canOfferTawi50,
  commissionPercent,
  formatPeriodMonth,
  historyGross,
  historyNetTotal,
  projectWithholding,
  rateProgressPercent,
  rateRemaining,
  type EarningsHistoryItem,
  type EarningsResponse,
} from "./lib/earnings";
import { SalesCsvDownloadButton } from "./sales-csv-download-button";
import { Tawi50DownloadButton } from "./tawi50-download-button";
import { TransferStatusBadge, TransferStatusProvider } from "./transfer-status-badge";

export type TutorProfile = {
  verificationStatus?: string;
  identity?: { taxResidency?: "RESIDENT" | "NON_RESIDENT" };
  settings?: {
    taxName?: string;
    nationalId?: string;
    address?: string;
    verification?: Record<string, { status?: string; comment?: string }>;
  };
};

const payoutStatus: Record<string, { label: string; tone: Tone }> = {
  draft: { label: t("dashboardEarnings.statuses.draft"), tone: "neutral" },
  pending: { label: t("dashboardEarnings.statuses.pending"), tone: "warning" },
  approved: { label: t("dashboardEarnings.statuses.approved"), tone: "success" },
  rejected: { label: t("dashboardEarnings.statuses.rejected"), tone: "danger" },
};

const money = (value: number, signed = false) => formatTHB(value, { fractionDigits: 2, signed });

const ADJUSTMENT_LABELS: AdjustmentReasonLabels = {
  refund: t("dashboardEarnings.adjustmentReasons.refund"),
  chargeback: t("dashboardEarnings.adjustmentReasons.chargeback"),
  chargebackReversal: t("dashboardEarnings.adjustmentReasons.chargebackReversal"),
  carryForward: t("dashboardEarnings.adjustmentReasons.carryForward"),
  heldCarryForward: t("dashboardEarnings.adjustmentReasons.heldCarryForward"),
};

/** One label/amount line of the month's statement (reading face, tabular money). */
function AmountRow({
  label,
  value,
  tone = "default",
  strong,
  className,
}: {
  label: ReactNode;
  value: string;
  tone?: "default" | "positive" | "negative" | "muted";
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-4 md:px-5",
        strong ? "bg-surface-muted py-3.5" : "py-2.5",
        className,
      )}
    >
      <dt
        className={cn(
          "min-w-0",
          strong ? "text-[0.9375rem] leading-normal font-semibold text-fg" : "type-body-s text-fg-muted",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "shrink-0 tabular",
          strong ? "text-[1.0625rem] leading-[1.3] font-semibold" : "text-sm leading-normal font-medium",
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
  const lines = adjustmentLines(item, t("dashboardEarnings.clawback"), ADJUSTMENT_LABELS);
  if (lines.length === 0) return <span className="text-fg-subtle">–</span>;
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((adj, i) => (
        <li key={i} className="min-w-0">
          <span className={cn("font-medium tabular", adj.amount < 0 ? "text-danger-fg" : "text-success-fg")}>
            {money(adj.amount, true)}
          </span>
          <span className="block truncate text-xs leading-normal text-fg-muted" title={adj.reason}>
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
    <div className="flex flex-col items-start gap-0.5 whitespace-nowrap @min-[73rem]:items-end">
      {item.network !== 0 ? <span className="text-success-fg">{money(item.network, true)}</span> : null}
      {badge !== 0 ? (
        <span className="text-xs text-fg-muted">
          Badge <span className="text-success-fg">{money(badge, true)}</span>
        </span>
      ) : null}
    </div>
  );
}

/** "ขาดอีก <b>฿1,550</b> เพื่อขึ้นเรทถัดไป" with the amount kept on one line. */
function RemainingNote({ amount }: { amount: string }) {
  const [before, after] = t("dashboardEarnings.walletRemaining").split("{amount}");
  return (
    <>
      {before}
      <b className="whitespace-nowrap">{amount}</b>
      {after}
    </>
  );
}

/**
 * Earnings (patterns.md T6): the wallet hero is the page's home, then a joined
 * stat strip and this month's statement, the payout-hold notice and the payout
 * history table (cards on phones). Data comes from page.tsx; nothing is
 * fetched here.
 */
export function EarningsView({ response, user }: { response: EarningsResponse | null; user: TutorProfile | null }) {
  const earnings = response?.currentProjection || EMPTY_PROJECTION;
  const history = response?.history || [];
  const rateInfo = response?.rateInfo || EMPTY_RATE_INFO;
  const periodMonth = response?.periodMonth || "";
  const periodLabel = formatPeriodMonth(periodMonth) || "–";

  const nonResident = user?.identity?.taxResidency === "NON_RESIDENT";
  const projection = projectWithholding(earnings.total, nonResident ? 15 : 3);
  const ratePercent = commissionPercent(rateInfo.rate);
  const rateLabel = `${formatNumber(ratePercent, Number.isInteger(ratePercent) ? 0 : 2)}%`;
  const progressPercent = rateProgressPercent(rateInfo);
  const projectionAdjustments = adjustmentLines(earnings, t("dashboardEarnings.clawback"), ADJUSTMENT_LABELS);
  const payoutPolicy = response?.payoutPolicy ?? DEFAULT_PAYOUT_POLICY;
  const holdNotice = t("dashboardEarnings.holdNoticeBody")
    .replace("{card}", String(payoutPolicy.cardHoldDays))
    .replace("{other}", String(payoutPolicy.otherHoldDays));
  const badgeBonus = earnings.badgeBonus ?? 0;
  // The finance service sends history newest first (settlement run createdAt desc) and includes
  // draft, pending and rejected runs; only an approved run counts as "งวดที่ปิดล่าสุด".
  const latestPayout = history.find((item) => item.status === "approved");

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
              className="text-[0.8125rem] leading-normal font-normal whitespace-nowrap text-fg-muted tabular"
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
      isEmpty: (item) => item.network === 0 && (item.badgeBonus ?? 0) === 0,
    },
    {
      key: "adjustments",
      header: t("dashboardEarnings.columns.adjustments"),
      className: "max-w-40",
      cell: (item) => <AdjustmentList item={item} />,
      isEmpty: (item) => adjustmentLines(item, t("dashboardEarnings.clawback"), ADJUSTMENT_LABELS).length === 0,
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
          <span className="text-[0.9375rem] font-semibold text-fg">{money(historyNetTotal(item))}</span>
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
          <div className="flex flex-col items-end gap-1.5 @min-[73rem]:items-start">
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

      {/* Row 1: the wallet (hero + strip) and this month's statement beside it from 1280px. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] xl:items-stretch">
        <div className="flex min-w-0 flex-col gap-4">
          <WalletHero
            label={t("dashboardEarnings.projectedIncomePrefix")}
            chip={t("dashboardEarnings.walletRateChip").replace("{rate}", rateLabel)}
            amount={money(projection.gross)}
            subline={nonResident ? t("dashboardEarnings.projectionWHTNoteNonResident") : t("dashboardEarnings.projectionWHTNote")}
            goal={{
              currentLabel: t("dashboardEarnings.rateVolume"),
              currentValue: formatTHB(rateInfo.volume, { fractionDigits: 0 }),
              targetLabel: t("dashboardEarnings.rateTitle"),
              targetValue: rateInfo.nextTarget > 0 ? formatTHB(rateInfo.nextTarget, { fractionDigits: 0 }) : "–",
              progress: progressPercent,
              progressLabel: t("dashboardEarnings.rateTitle"),
              note:
                rateInfo.nextTarget > 0 ? (
                  <RemainingNote amount={formatTHB(rateRemaining(rateInfo), { fractionDigits: 0 })} />
                ) : (
                  t("dashboardEarnings.maxRate")
                ),
            }}
          />
          <StatStrip
            aria-label={t("dashboardEarnings.title")}
            // Stretched to the statement's height from 1280px: content centred, rows aligned.
            align="center"
            className="xl:flex-1"
            items={[
              {
                label: t("dashboardEarnings.stats.netEstimate"),
                value: money(projection.net),
                hint: nonResident ? t("dashboardEarnings.stats.afterWHTNonResident") : t("dashboardEarnings.stats.afterWHT"),
              },
              {
                label: t("dashboardEarnings.stats.direct"),
                value: money(earnings.directSales),
                hint: periodLabel,
              },
              {
                label: t("dashboardEarnings.stats.network"),
                value: money(earnings.networkBonus, true),
                hint:
                  badgeBonus > 0 ? `${t("dashboardEarnings.stats.badgeBonusHint")} ${money(badgeBonus, true)}` : periodLabel,
              },
              {
                label: t("dashboardEarnings.lastPayoutLabel"),
                value: latestPayout ? money(historyNetTotal(latestPayout)) : "–",
                hint: latestPayout ? formatPeriodMonth(latestPayout.date) : t("dashboardEarnings.noClosedPayout"),
              },
            ]}
          />
        </div>

        <Surface as="section" padding="none" aria-labelledby="earnings-statement-title" className="flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 md:px-5 md:pt-5">
            <h2 id="earnings-statement-title" className="type-section text-fg">
              {t("dashboardEarnings.projectionTitle")}
            </h2>
            <Chip tone="neutral">{periodLabel}</Chip>
          </div>
          {/* The line items hug their rows; the total is the card's footer (own top hairline), pinned to the
              bottom when the card stretches to the wallet's height from 1280px, so spare height reads as
              space before the footer, not as an empty line item. */}
          <dl className="flex flex-col divide-y divide-hairline">
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
                label={nonResident ? t("dashboardEarnings.withholdingTaxEstimatedNonResident") : t("dashboardEarnings.withholdingTaxEstimated")}
                value={money(-projection.wht)}
                tone="negative"
              />
            ) : null}
          </dl>
          <dl className="mt-auto border-t border-hairline">
            <AmountRow label={t("dashboardEarnings.estimatedNetPayout")} value={money(projection.net)} strong />
          </dl>
        </Surface>
      </div>

      <Notice tone="info" icon={ShieldCheck} title={t("dashboardEarnings.holdNoticeTitle")}>
        <p>{thaiCopy(holdNotice)}</p>
      </Notice>

      <Section
        title={t("dashboardEarnings.payoutHistory")}
        description={history.length > 0 ? t("dashboardEarnings.historyDescription") : undefined}
      >
        <TransferStatusProvider initial={transferRows}>
          {/* The 8-column table needs 1160px with its widest rows (six-digit amounts, document number,
              transfer chip, 50 ทวิ button; measured on /dev/earnings-preview), so it switches on its own
              width: below a 73rem container (up to about 1500px wide with the full side nav, 1335px with
              it collapsed) the cards stay, two per row from 48rem, and the table never scrolls sideways
              inside its card. */}
          <DataTable
            caption={t("dashboardEarnings.payoutHistory")}
            columns={columns}
            rows={history}
            breakpoint="container"
            containerBreakpoint="73rem"
            cards="grid"
            getRowKey={(item) => `${item.date}-${item.status}-${item.payoutLineId ?? ""}`}
            empty={
              <EmptyState
                mascot
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
