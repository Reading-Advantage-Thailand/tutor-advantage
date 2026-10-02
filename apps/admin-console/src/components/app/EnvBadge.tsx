import { t } from "@/lib/i18n";
import type { AppEnvironment } from "@/lib/security";
import { cn } from "@/lib/utils";

const ENV_META: Record<AppEnvironment, { label: string; className: string } | null> = {
  development: { label: t("shell.envDevelopment"), className: "border-warning-border bg-warning-bg text-warning-fg" },
  staging: { label: t("shell.envStaging"), className: "border-info-border bg-info-bg text-info-fg" },
  // Production shows no pill: the absence is the signal (no "PRODUCTION" banner in dev any more).
  production: null,
};

/** Environment pill (driven by APP_ENV / NODE_ENV on the server). Server-compatible. */
export function EnvBadge({ environment, className }: { environment: AppEnvironment; className?: string }) {
  const meta = ENV_META[environment];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.6875rem] leading-none font-semibold whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}
