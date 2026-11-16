"use client";

import dynamic from "next/dynamic";
import { BookOpen, Check, ChevronRight, Copy, QrCode } from "lucide-react";
import { BottomSheet, IconTile, ListGroup, ListRow, Skeleton, Spinner, TextField } from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { getEnrollmentKey, type Enrollment } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { useReferralInvite } from "./useReferralInvite";

const QR_SIZE = 220;

// The QR encoder is only downloaded when the QR sheet first renders it.
const QRCodeSVG = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <Skeleton className="size-[244px] rounded-xl" />,
});

/** Warm the QR chunk while the finger is still on the button. */
function preloadQrCode() {
  void import("qrcode.react");
}

/**
 * "ชวนเพื่อนมาเรียน" (patterns.md S1.5): a container card (rim, no ledge) with
 * one tonal button → class picker (several classes) → QR sheet with the share
 * link and a copy button.
 */
export function InviteFriendCard({ shareable }: { shareable: Enrollment[] }) {
  const referral = useReferralInvite(shareable);
  const singleLoading = referral.busy && !referral.pickerOpen;

  return (
    <>
      <section
        aria-labelledby="invite-friend-title"
        className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-center gap-3.5">
          <IconTile icon={QrCode} tone="teal" size="lg" />
          <div className="min-w-0 flex-1">
            <h2 id="invite-friend-title" className="t-title-s text-fg">
              {t("dashboard.shareTitle")}
            </h2>
            <p className="t-body-s text-fg-muted">{thaiCopy(t("dashboard.shareDescription"))}</p>
          </div>
        </div>
        <button
          id="btn-copy-referral"
          type="button"
          onClick={referral.start}
          onPointerDown={preloadQrCode}
          aria-busy={singleLoading || undefined}
          aria-describedby="invite-friend-title"
          className={cn(buttonVariants({ variant: "brandSoft", size: "touch" }), "mt-3.5 w-full")}
        >
          {singleLoading ? <Spinner size="sm" /> : <QrCode aria-hidden="true" />}
          {t("dashboard.referralQrTitle")}
          <ChevronRight aria-hidden="true" className="-mr-1" />
        </button>
      </section>

      <BottomSheet
        open={referral.pickerOpen}
        onOpenChange={referral.setPickerOpen}
        title={t("dashboard.referralPickerTitle")}
        description={t("dashboard.referralPickerSubtitle")}
      >
        <ListGroup>
          {shareable.map((enrollment, index) => {
            const loadingThis = referral.loadingClassId === enrollment.id;
            return (
              <ListRow
                key={getEnrollmentKey(enrollment, index)}
                onClick={() => void referral.openForClass(enrollment.id)}
                disabled={referral.busy && !loadingThis}
                leading={<IconTile icon={BookOpen} tone="brand" />}
                title={enrollment.name}
                subtitle={[enrollment.tutorName, enrollment.seriesCefr].filter(Boolean).join(" · ")}
                trailing={
                  loadingThis ? (
                    <Spinner size="sm" />
                  ) : (
                    <QrCode aria-hidden="true" className="size-5 text-brand-fg" />
                  )
                }
              />
            );
          })}
        </ListGroup>
      </BottomSheet>

      <BottomSheet
        open={referral.qrOpen}
        onOpenChange={referral.setQrOpen}
        onClosed={referral.clearInvite}
        title={t("dashboard.referralQrTitle")}
        // The class name is data: as a node the sheet shows it as it is (a string would go through thaiCopy).
        description={referral.invite?.className ? <>{referral.invite.className}</> : t("dashboard.referralQrSubtitle")}
        footer={
          <Button
            variant="brand"
            size="cta"
            className="w-full"
            onClick={() => void referral.copyLink()}
            disabled={!referral.invite}
          >
            {referral.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {referral.copied ? t("dashboard.referralCopiedButton") : t("dashboard.copyReferral")}
          </Button>
        }
      >
        {referral.invite ? (
          <div className="flex flex-col items-center gap-4">
            {/* Always on white so any phone camera can scan it, also in dark mode. */}
            <div
              role="img"
              aria-label={t("dashboard.referralQrAria")}
              className="rounded-2xl border border-hairline bg-white p-3"
            >
              <QRCodeSVG value={referral.invite.url} size={QR_SIZE} level="M" includeMargin />
            </div>
            <p className="max-w-[300px] text-center text-sm leading-[1.6] text-fg-muted">
              {t("dashboard.referralQrHint")}
            </p>
            <TextField
              label={t("dashboard.referralLinkLabel")}
              value={referral.invite.url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="w-full"
              inputClassName="font-mono"
            />
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
