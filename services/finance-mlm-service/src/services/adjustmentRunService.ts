import type { Prisma } from "@prisma/client";
import { getIctMonthWindow } from "./commissionService";

/** Runs that may still receive new adjustments. */
export const MUTABLE_RUN_STATUSES = ["DRAFT", "ADJUSTMENT_PENDING", "REJECTED"];

type Db = Prisma.TransactionClient;

export function getFollowingIctPeriodMonth(periodMonth: string) {
  const [yearText, monthText] = periodMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextPeriod = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  getIctMonthWindow(nextPeriod);
  return nextPeriod;
}

/**
 * Returns the first settlement run, starting at `startPeriod`, that can still
 * take adjustments. Never attaches to a submitted/approved run; when a period
 * has no run yet an ADJUSTMENT_PENDING holder is created (the monthly
 * scheduler later turns it into the real preview).
 *
 * `inTransaction` = called inside an interactive transaction: a unique-key
 * race cannot be retried there, so the error is thrown and the whole
 * transaction can be retried by the caller.
 */
export async function findOrCreateMutableRun(
  db: Db,
  startPeriod: string,
  createdBy: string,
  options: { inTransaction?: boolean } = {},
) {
  let period = startPeriod;
  for (let guard = 0; guard < 36; guard += 1) {
    const candidate = await db.settlementRun.findFirst({
      where: { periodMonth: period },
      orderBy: { createdAt: "desc" },
    });
    if (candidate && MUTABLE_RUN_STATUSES.includes(candidate.status)) return candidate;
    if (candidate) {
      period = getFollowingIctPeriodMonth(period);
      continue;
    }
    try {
      return await db.settlementRun.create({
        data: {
          periodMonth: period,
          status: "ADJUSTMENT_PENDING",
          createdBy,
          previewPayload: {},
        },
      });
    } catch (error) {
      if (options.inTransaction || (error as { code?: string }).code !== "P2002") throw error;
      const raced = await db.settlementRun.findFirst({
        where: { periodMonth: period },
        orderBy: { createdAt: "desc" },
      });
      if (raced && MUTABLE_RUN_STATUSES.includes(raced.status)) return raced;
      period = getFollowingIctPeriodMonth(period);
    }
  }
  throw new Error("NO_MUTABLE_SETTLEMENT_RUN");
}
