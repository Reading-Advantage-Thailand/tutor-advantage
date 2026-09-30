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

function usageCost(providerUsage: unknown, key: "measuredRealtimeCostUsd" | "measuredTranscriptionCostUsd"): number | null {
  if (!providerUsage || typeof providerUsage !== "object" || Array.isArray(providerUsage)) return null;
  const value = (providerUsage as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function measuredCosts(providerUsage: unknown) {
  const realtime = usageCost(providerUsage, "measuredRealtimeCostUsd");
  const transcription = usageCost(providerUsage, "measuredTranscriptionCostUsd");
  return { realtime, transcription, total: realtime === null ? null : realtime + (transcription ?? 0) };
}

export function summarizeVoiceOperations(rows: VoiceOperationRow[]) {
  const started = rows.filter((row) => row.startedAt !== null);
  const finished = started.filter((row) => row.status === "ENDED");
  const failedStarts = rows.filter((row) => row.status === "PROVIDER_FAILED" || (["LEASE_EXPIRED", "CONNECTION_TIMEOUT"].includes(row.endReason || "") && !row.startedAt));
  const disconnected = finished.filter((row) => row.endReason === "CONNECTION_LOST");
  const summaryFailures = finished.filter((row) => !row.summary);
  // A session counts as measured once its Realtime usage is complete. Sessions
  // recorded before transcription metering have no transcription amount.
  const measured = finished.map((row) => measuredCosts(row.providerUsage)).filter((cost) => cost.realtime !== null);
  const totalRealtimeUsd = measured.reduce((sum, cost) => sum + (cost.realtime ?? 0), 0);
  const totalTranscriptionUsd = measured.reduce((sum, cost) => sum + (cost.transcription ?? 0), 0);
  const totalMeasuredUsd = totalRealtimeUsd + totalTranscriptionUsd;
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
    missingTranscriptionCostSessions: measured.filter((cost) => cost.transcription === null).length,
    totalMeasuredCostUsd: totalMeasuredUsd,
    totalMeasuredRealtimeCostUsd: totalRealtimeUsd,
    totalMeasuredTranscriptionCostUsd: totalTranscriptionUsd,
    averageMeasuredCostUsd: measured.length ? totalMeasuredUsd / measured.length : null,
    averageMeasuredRealtimeCostUsd: measured.length ? totalRealtimeUsd / measured.length : null,
    recentSessions: rows.slice(0, 50).map((row) => {
      const cost = measuredCosts(row.providerUsage);
      return {
        sessionId: row.voiceSessionId,
        createdAt: row.createdAt,
        status: row.status,
        endReason: row.endReason,
        consumedSeconds: row.consumedSeconds,
        summaryAvailable: Boolean(row.summary),
        measuredRealtimeCostUsd: cost.realtime,
        measuredTranscriptionCostUsd: cost.transcription,
        measuredCostUsd: cost.total,
      };
    }),
  };
}
