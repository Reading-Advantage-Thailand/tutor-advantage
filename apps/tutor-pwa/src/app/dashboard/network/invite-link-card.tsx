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
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border/40 bg-card/65 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-300">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("dashboardNetwork.inviteLinkTitle")}</p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-muted/60 dark:bg-muted/30 border border-border/30 px-3.5 py-2.5 text-xs text-muted-foreground font-semibold">
          {inviteUrl}
        </code>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={copyInviteLink}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-500/25 bg-brand-500/5 hover:bg-brand-500 hover:text-white px-4 text-xs font-bold text-brand-600 dark:text-brand-400 hover:shadow-md hover:shadow-brand-500/10 hover:-translate-y-0.5 transition-all duration-200 press-scale"
          >
            {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0 animate-pulse" />}
            {copied ? t("dashboardNetwork.copied") : t("dashboardNetwork.copy")}
          </button>
          <a
            href={inviteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-card hover:bg-muted/10 text-muted-foreground hover:text-foreground transition-all duration-200 press-scale"
            aria-label={t("dashboardNetwork.openInviteAria")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
