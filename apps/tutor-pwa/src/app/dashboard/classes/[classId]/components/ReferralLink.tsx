"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CheckCircle2, Copy, QrCode, Share2 } from "lucide-react";
import { Sheet, Skeleton } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { PanelCard } from "./PanelCard";
import { useCopy } from "./useCopy";

const ReferralQr = dynamic(() => import("./ReferralQr"), {
  ssr: false,
  loading: () => <Skeleton className="size-[232px] rounded-lg" />,
});

/** Shortens "https://liff.line.me/…/enroll?classId=…" for display; the full link is copied. */
function displayLink(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/** Invite link card: copy + QR (qrcode.react is loaded only when the QR sheet opens). */
export function ReferralLink({ referralLink }: { referralLink: string }) {
  const { copied, copy } = useCopy();
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <PanelCard
      id="class-share-title"
      icon={Share2}
      tone="brand"
      title={t("tutorClass.ui.shareTitle")}
      description={t("tutorClass.detail.referralHelp")}
    >
      {referralLink ? (
        <>
          <p
            className="ds-well truncate px-3 py-2.5 font-mono text-[0.8125rem] leading-normal text-fg-muted"
            title={referralLink}
          >
            {displayLink(referralLink)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button id="btn-copy-referral" variant="soft" size="lg" onClick={() => copy(referralLink)}>
              {copied ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span aria-live="polite">{copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => setQrOpen(true)}>
              <QrCode aria-hidden="true" />
              {t("tutorClass.ui.showQr")}
            </Button>
          </div>
          <Sheet
            open={qrOpen}
            onOpenChange={setQrOpen}
            title={t("tutorClass.detail.referralTitle")}
            description={t("tutorClass.ui.qrDescription")}
            width={400}
            footer={
              <Button variant="outline" size="lg" className="w-full" onClick={() => copy(referralLink)}>
                {copied ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}
              </Button>
            }
          >
            <div className="flex justify-center rounded-xl border border-hairline bg-surface-white p-4">
              {qrOpen ? <ReferralQr value={referralLink} /> : null}
            </div>
          </Sheet>
        </>
      ) : (
        <p className="text-sm leading-[1.6] text-fg-muted">{t("tutorClass.classes.notSet")}</p>
      )}
    </PanelCard>
  );
}
