import type { ReactNode } from "react";

/**
 * Read-only "label over value" row for a <ListGroup> (uses the list-row
 * divider styles so rows separate like <ListRow>s): flat, 64px min, label 13
 * muted above the value in the reading face (row titles are never Kodchasan).
 * Server-compatible.
 */
export function InfoRow({ leading, label, value }: { leading: ReactNode; label: ReactNode; value: ReactNode }) {
  return (
    <div className="list-row flex min-h-16 items-center gap-3.5 px-4 py-2.5" data-leading="">
      <span className="flex shrink-0 items-center">{leading}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[1.6] text-fg-muted">{label}</p>
        <p className="text-base leading-[1.6] font-semibold break-words text-fg">{value}</p>
      </div>
    </div>
  );
}
