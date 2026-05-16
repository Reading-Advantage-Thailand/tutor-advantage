"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { t } from "@/lib/i18n";

export function InviteLinkCard({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">{t("dashboardNetwork.inviteLinkTitle")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {inviteUrl}
        </code>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyInviteLink}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("dashboardNetwork.copied") : t("dashboardNetwork.copy")}
          </button>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            aria-label={t("dashboardNetwork.openInviteAria")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
