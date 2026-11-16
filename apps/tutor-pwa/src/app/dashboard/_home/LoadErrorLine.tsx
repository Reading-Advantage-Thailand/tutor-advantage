import { AlertTriangle } from "lucide-react";
import { IconTile } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * "ลองใหม่" for a Home block whose data failed: like the page notice's retry,
 * a full reload re-runs every server fetch on this page.
 */
export function RetryButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <Button variant="outline" size={size} render={<a href="/dashboard" />} nativeButton={false}>
      {t("shell.retry")}
    </Button>
  );
}

/**
 * A Home block whose own data failed to load (patterns.md "Error (load)",
 * tutor): an amber tone tile, the cause and a retry, in place of an empty
 * state that would say there is nothing. Server component.
 */
export function LoadErrorLine({ text, retry = true }: { text: string; retry?: boolean }) {
  return (
    <div className="ds-card flex min-h-16 items-center gap-3 px-4 py-3">
      <IconTile icon={AlertTriangle} tone="amber" />
      <p className="min-w-0 flex-1 type-body-s text-fg">{text}</p>
      {retry ? <RetryButton /> : null}
    </div>
  );
}
