"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Share2 } from "lucide-react";
import { IconTile, Surface, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { shortInviteLabel } from "./network-data";

export function InviteLinkCard({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success(t("dashboardNetwork.copied"));
    } catch {
      toast.error(t("dashboardNetwork.copyFailed"));
    }
  };

  const shareInviteLink = async () => {
    try {
      await navigator.share({ title: t("dashboardNetwork.inviteTitle"), url: inviteUrl });
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <Surface padding="md" className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile icon={Link2} tone="brand" size="sm" />
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-fg">{t("dashboardNetwork.inviteTitle")}</h2>
          <p className="mt-0.5 text-sm text-fg-muted">{t("dashboardNetwork.inviteLinkHint")}</p>
          <p className="mt-1 truncate text-[0.8125rem] text-fg-subtle" title={inviteUrl}>
            {shortInviteLabel(inviteUrl, 48)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="soft" onClick={copyInviteLink} className="flex-1 md:flex-none">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t("dashboardNetwork.copied") : t("dashboardNetwork.copyInvite")}
        </Button>
        {canShare ? (
          <Button variant="outline" onClick={shareInviteLink} className="flex-1 md:flex-none">
            <Share2 aria-hidden="true" />
            {t("dashboardNetwork.shareInvite")}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          aria-label={t("dashboardNetwork.openInviteAria")}
          render={<a href={inviteUrl} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
    </Surface>
  );
}
