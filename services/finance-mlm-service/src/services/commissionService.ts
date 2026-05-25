const RATE_SCALE = 1_000_000_000n;

export function getIctMonthWindow(periodMonth: string) {
  const [yearText, monthText] = periodMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("INVALID_PERIOD_MONTH");
  }

  return {
    // Start: 1st of month at 00:00:00 ICT = 17:00 prev-day UTC
    start: new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0)),
    // End: last day of month at 12:00:00 ICT = 05:00:00 UTC same day
    end: new Date(Date.UTC(year, month, 0, 5, 0, 0, 0)),
  };
}

export function formatIctPeriodMonth(date = new Date()) {
  const ictDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${ictDate.getUTCFullYear()}-${String(ictDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calculateCommissionRate(volumeTHB: number) {
  const baseRate = Number(process.env.COMMISSION_BASE_RATE || "0.5");

  if (!Number.isFinite(volumeTHB) || volumeTHB <= 0) {
    return 0;
  }

  if (volumeTHB >= 20000) {
    return (
      (baseRate *
        (1 - Math.pow(0.3, 1 + Math.log(volumeTHB / 20000) / Math.log(5)))) /
      0.7
    );
  }

  return 0.4 + volumeTHB / 200000;
}

// Tier breakpoints for nextTarget display — rate formula is unchanged.
// Linear section (below ฿20K): steps every ฿2–5K.
// Exponential section (฿20K+): ~1.5–2× steps for visible progress.
const TIER_BREAKPOINTS = [
  2_000, 5_000, 10_000, 15_000, 20_000,
  30_000, 50_000, 70_000, 100_000,
  150_000, 200_000, 300_000, 500_000,
];

export function calculateCommissionInfo(volumeTHB: number) {
  const nextTarget =
    TIER_BREAKPOINTS.find((t) => t > volumeTHB) ?? 0;

  return {
    rate: calculateCommissionRate(volumeTHB),
    nextTarget,
  };
}

export function calculatePayoutMinor(volumeMinor: bigint, rate: number) {
  if (volumeMinor <= 0n || rate <= 0) return 0n;
  const scaledRate = BigInt(Math.round(rate * Number(RATE_SCALE)));
  return (volumeMinor * scaledRate) / RATE_SCALE;
}
