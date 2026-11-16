"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Share2 } from "lucide-react";
import { IconTile, Surface, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { shortInviteLabel } from "./network-data";

/**
 * Share card (patterns.md T7): the invite link in a well and "คัดลอกลิงก์" as
 * the page's one primary, then share (when the device can) and open. Stacked
 * in the side column; one row when the card is wide (container query).
 */
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
    <Surface as="section" padding="none" aria-labelledby="invite-link-title" className="@container">
      <div className="flex flex-col gap-4 p-4 md:p-5 @2xl:flex-row @2xl:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconTile icon={Link2} tone="brand" />
          <div className="min-w-0 flex-1">
            <h2 id="invite-link-title" className="type-card text-fg">
              {t("dashboardNetwork.inviteTitle")}
            </h2>
            <p className="mt-0.5 text-sm leading-[1.6] text-pretty text-fg-muted">{thaiCopy(t("dashboardNetwork.inviteLinkHint"))}</p>
            <p
              className="ds-well mt-2.5 truncate px-3 py-2 font-mono text-[0.8125rem] leading-normal text-fg-muted"
              title={inviteUrl}
            >
              {shortInviteLabel(inviteUrl, 48)}
            </p>
          </div>
        </div>
        {/* Content-based basis (no min-w-0), so a label is never clipped: when copy, share and open do
            not fit on one row (320px phones, the 340px side column), share + open wrap together to a
            second row and the copy button takes the full first row. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="lg" onClick={copyInviteLink} className="flex-[1_1_auto] @2xl:flex-none">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t("dashboardNetwork.copied") : t("dashboardNetwork.copyInvite")}
          </Button>
          <div className={cn("flex items-center gap-2", canShare ? "flex-[1_1_auto] @2xl:flex-none" : "flex-none")}>
            {canShare ? (
              <Button variant="outline" size="lg" onClick={shareInviteLink} className="flex-[1_1_auto] @2xl:flex-none">
                <Share2 aria-hidden="true" />
                {t("dashboardNetwork.shareInvite")}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon-lg"
              aria-label={t("dashboardNetwork.openInviteAria")}
              render={<a href={inviteUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </Surface>
  );
}
