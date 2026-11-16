import { t } from "@/lib/i18n";
import type { AppEnvironment } from "@/lib/security";
import { cn } from "@/lib/utils";

const ENV_META: Record<AppEnvironment, { label: string; className: string } | null> = {
  development: { label: t("shell.envDevelopment"), className: "bg-warning-bg text-warning-fg" },
  staging: { label: t("shell.envStaging"), className: "bg-info-bg text-info-fg" },
  // Production shows no chip: the absence is the signal (no "PRODUCTION" banner in dev any more).
  production: null,
};

/**
 * Environment chip (driven by APP_ENV / NODE_ENV on the server): dot + word,
 * radius 6. `block` = the full-width 26px chip under the side-nav brand block
 * (in the 72px rail it shrinks to the dot; the word stays for screen readers
 * and as the tooltip). Server-compatible.
 */
export function EnvBadge({ environment, className, block }: { environment: AppEnvironment; className?: string; block?: boolean }) {
  const meta = ENV_META[environment];
  if (!meta) return null;
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-chip) text-xs leading-normal font-medium whitespace-nowrap",
        block ? "flex h-[26px] w-full justify-center px-2" : "h-6 px-2",
        meta.className,
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className={cn(block && "sr-only @min-[160px]:not-sr-only")}>{meta.label}</span>
    </span>
  );
}
