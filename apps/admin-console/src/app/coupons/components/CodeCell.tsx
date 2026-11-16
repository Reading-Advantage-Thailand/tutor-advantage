"use client";

import { CopyButton } from "@/components/app";
import { CELL_CLAMP } from "../../classes/components/cellText";
import { focusAnchorProps } from "../../classes/components/focusRescue";

/**
 * Identity column of the coupon and discount-code tables: the code (monospace
 * 600 14) with its copy button, and the admin's note under it (13, muted,
 * cut with an ellipsis and narrowed first when the table is tight; the full
 * note is in the title). The copy button is the row's focus anchor when a void
 * removes the row's actions.
 */
export function CodeCell({ id, code, note, copyLabel }: { id: string; code: string; note: string | null; copyLabel: string }) {
  return (
    <span className="flex min-w-0 flex-col" {...focusAnchorProps(id)}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <code className="font-mono text-sm leading-[1.45] font-semibold tracking-wide text-fg">{code}</code>
        <CopyButton value={code} label={copyLabel} />
      </span>
      {note ? (
        <span className={`max-w-40 text-[0.8125rem] leading-[1.45] text-fg-muted ${CELL_CLAMP}`} title={note}>
          {note}
        </span>
      ) : null}
    </span>
  );
}
