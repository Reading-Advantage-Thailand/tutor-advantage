import type { ReactNode } from "react";
import { SectionHeader } from "@/components/mobile";
import { cn } from "@/lib/utils";

/** One gallery section (h3 inside a theme pane). */
export function Section({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <SectionHeader title={title} as="h3" />
      {note ? <p className="-mt-2 text-[13px] leading-[1.55] text-fg-muted">{note}</p> : null}
      {children}
    </section>
  );
}

/** Labelled frame around a sample (the frame is gallery chrome, not a component). */
export function Frame({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-xs leading-[1.5] font-medium text-fg-subtle">{label}</p>
      <div className={cn("overflow-hidden rounded-[20px] border-[1.5px] border-dashed border-clay-rim bg-app", className)}>
        {children}
      </div>
    </div>
  );
}

/** Token swatch: the fill with its name and the text colour that sits on it. */
export function Swatch({ fill, on }: { fill: string; on?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border-[1.5px] border-clay-rim text-sm font-semibold"
        style={{ background: `var(${fill})`, color: on ? `var(${on})` : undefined }}
      >
        {on ? "Aa" : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-xs leading-[1.5] text-fg">{fill}</span>
        {on ? <span className="block truncate font-mono text-xs leading-[1.5] text-fg-muted">{on}</span> : null}
      </span>
    </div>
  );
}
