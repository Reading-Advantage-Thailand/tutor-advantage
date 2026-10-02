"use client";

import dynamic from "next/dynamic";
import { BookOpen, Check, ChevronRight, Copy, QrCode } from "lucide-react";
import { BottomSheet, IconTile, ListGroup, ListRow, Skeleton, Spinner, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { getEnrollmentKey, type Enrollment } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
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
 * "ชวนเพื่อนมาเรียน": one full-width button → class picker (several classes) →
 * QR sheet with the share link and a copy button.
 */
export function InviteFriendCard({ shareable }: { shareable: Enrollment[] }) {
  const referral = useReferralInvite(shareable);
  const singleLoading = referral.busy && !referral.pickerOpen;

  return (
    <>
      <button
        id="btn-copy-referral"
        type="button"
        onClick={referral.start}
        onPointerDown={preloadQrCode}
        aria-busy={singleLoading || undefined}
        className="pressable flex min-h-[72px] w-full items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-4 text-left shadow-[var(--shadow-card)] active:bg-press"
      >
        <IconTile icon={QrCode} tone="brand" size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-[1.5] font-semibold text-fg">{t("dashboard.shareTitle")}</span>
          <span className="block text-[13px] leading-[1.5] text-fg-muted">{t("dashboard.shareDescription")}</span>
        </span>
        {singleLoading ? (
          <Spinner size="sm" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-subtle" />
        )}
      </button>

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
        description={referral.invite?.className || t("dashboard.referralQrSubtitle")}
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
