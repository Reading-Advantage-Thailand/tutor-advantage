export type VoiceOperationRow = {
  voiceSessionId: string;
  createdAt: Date;
  startedAt: Date | null;
  status: string;
  endReason: string | null;
  consumedSeconds: number;
  summary: unknown;
  providerUsage: unknown;
};

function measuredCost(providerUsage: unknown): number | null {
  if (!providerUsage || typeof providerUsage !== "object" || Array.isArray(providerUsage)) return null;
  const value = (providerUsage as Record<string, unknown>).measuredRealtimeCostUsd;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function summarizeVoiceOperations(rows: VoiceOperationRow[]) {
  const started = rows.filter((row) => row.startedAt !== null);
  const finished = started.filter((row) => row.status === "ENDED");
  const failedStarts = rows.filter((row) => row.status === "PROVIDER_FAILED" || (["LEASE_EXPIRED", "CONNECTION_TIMEOUT"].includes(row.endReason || "") && !row.startedAt));
  const disconnected = finished.filter((row) => row.endReason === "CONNECTION_LOST");
  const summaryFailures = finished.filter((row) => !row.summary);
  const measured = finished.map((row) => ({ row, cost: measuredCost(row.providerUsage) })).filter((item): item is { row: VoiceOperationRow; cost: number } => item.cost !== null);
  const totalMeasuredUsd = measured.reduce((sum, item) => sum + item.cost, 0);
  return {
    attempts: rows.length,
    started: started.length,
    failedStarts: failedStarts.length,
    failedStartRate: rows.length ? failedStarts.length / rows.length : 0,
    disconnected: disconnected.length,
    disconnectRate: finished.length ? disconnected.length / finished.length : 0,
    summaryFailures: summaryFailures.length,
    summaryFailureRate: finished.length ? summaryFailures.length / finished.length : 0,
    finished: finished.length,
    measuredCostSessions: measured.length,
    missingCostSessions: finished.length - measured.length,
    totalMeasuredRealtimeCostUsd: totalMeasuredUsd,
    averageMeasuredRealtimeCostUsd: measured.length ? totalMeasuredUsd / measured.length : null,
    recentSessions: rows.slice(0, 50).map((row) => ({
      sessionId: row.voiceSessionId,
      createdAt: row.createdAt,
      status: row.status,
      endReason: row.endReason,
      consumedSeconds: row.consumedSeconds,
      summaryAvailable: Boolean(row.summary),
      measuredRealtimeCostUsd: measuredCost(row.providerUsage),
    })),
  };
}
