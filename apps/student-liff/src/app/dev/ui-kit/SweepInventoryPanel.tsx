import { CircleCheck } from "lucide-react";
import { Chip } from "@/components/mobile";
import { cn } from "@/lib/utils";
import { SWEEP_GENERATED_AT, SWEEP_ROWS, SWEEP_TOTALS } from "./sweepInventoryData";

/** README §5 item 4: the student files whose text-white sat on a brand fill (swept to text-on-brand). */
const TEXT_WHITE_FILES = [
  "components/ui/button.tsx",
  "components/mobile/Chip.tsx",
  "components/mobile/SegmentedControl.tsx",
  "components/mobile/IconButton.tsx",
  "components/icons/BrandMark.tsx",
  "app/progress/_components/ProgressHero.tsx",
  "app/progress/_components/LessonList.tsx",
  "app/dashboard/_components/QuickActions.tsx",
  "app/chat/[conversationId]/_components/ChatRoom.tsx",
  "app/chat/[conversationId]/_components/Composer.tsx",
  "app/chat/[conversationId]/_components/MessageBubble.tsx",
  "app/chat/_components/ConversationRow.tsx",
  "app/payment/_components/PromptPayStep.tsx",
  "app/payment/_components/SelectMethodStep.tsx",
  "app/support/_components/OptionPicker.tsx",
  "app/support/_components/TicketThread.tsx",
  "app/schedule/_components/MonthCalendar.tsx",
  "app/guardian/_components/GuardianFormParts.tsx",
  "app/lesson/[classId]/page.tsx",
  "app/lesson/history/[sessionId]/page.tsx",
  "components/courses/CatalogRetry.tsx",
  "components/providers/ConsentGate.tsx",
] as const;

function Count({ value }: { value: number }) {
  return (
    <td className={cn("px-2 py-2 text-right tabular-nums", value === 0 ? "text-fg-subtle" : "font-semibold text-fg")}>
      {value}
    </td>
  );
}

/**
 * Acceptance checklist for the colour sweep (README §8 step 2): generated
 * counts per route, outside the six games. A route is migrated when its row
 * reads zero. Regenerate with `node scripts/sweep-inventory.mjs`.
 */
export function SweepInventory() {
  const migrated = SWEEP_TOTALS.textWhiteOnBrand === 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "Tailwind palette", value: SWEEP_TOTALS.palette },
          { label: "white / black", value: SWEEP_TOTALS.whiteBlack },
          { label: "hex (UI)", value: SWEEP_TOTALS.hex },
          { label: "text-white on brand", value: SWEEP_TOTALS.textWhiteOnBrand },
        ].map((item) => (
          <div key={item.label} className="rounded-[18px] border-[1.5px] border-clay-rim bg-surface px-3.5 py-2.5">
            <p className="text-[22px] leading-[1.3] font-semibold text-fg tabular-nums">{item.value}</p>
            <p className="text-[13px] leading-[1.5] text-fg-muted">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[340px] border-collapse text-[13px] leading-[1.5]">
            <caption className="sr-only">Raw colours per route, generated {SWEEP_GENERATED_AT}</caption>
            <thead className="bg-surface-muted text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Route</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">palette</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">w/b</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">hex</th>
                <th scope="col" className="px-2 py-2 pr-3 text-right font-semibold">art</th>
              </tr>
            </thead>
            <tbody>
              {SWEEP_ROWS.map((row) => (
                <tr key={row.route} className="border-t-[1.5px] border-hairline align-top">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block font-mono text-xs leading-[1.5] break-all text-fg">{row.route}</span>
                    <span className="block text-xs leading-[1.5] break-all text-fg-subtle">{row.files.join(", ")}</span>
                  </th>
                  <Count value={row.palette} />
                  <Count value={row.whiteBlack} />
                  <Count value={row.hex} />
                  <td className="px-2 py-2 pr-3 text-right text-fg-subtle tabular-nums">{row.artHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t-[1.5px] border-hairline px-3.5 py-2.5 text-xs leading-[1.5] text-fg-muted">
          Generated {SWEEP_GENERATED_AT} by <code className="font-mono">scripts/sweep-inventory.mjs</code>. “art” = Reedy and the LINE logo keeping their own colours (never swept). Games are excluded.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-base leading-[1.45] font-semibold text-fg">text-white → text-on-brand</p>
          <Chip tone={migrated ? "success" : "warning"} icon={migrated ? CircleCheck : undefined} dot={!migrated}>
            {migrated ? "เสร็จแล้ว" : `${SWEEP_TOTALS.textWhiteOnBrand} จุด`}
          </Chip>
        </div>
        <ul className="mt-2 space-y-0.5">
          {TEXT_WHITE_FILES.map((file) => (
            <li key={file} className="flex items-start gap-2 text-xs leading-[1.6] text-fg-muted">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
              <span className="font-mono break-all">{file}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
