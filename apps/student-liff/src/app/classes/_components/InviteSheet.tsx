"use client";

import { useState, type FormEvent } from "react";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { buildEnrollPathFromInviteText } from "@/lib/paymentFlow";

export interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Starts the LINE QR scanner (same handler as the header button). */
  onScan: () => void;
  /** Called with the relative "/enroll?…" path of a valid invite link. */
  onNavigate: (enrollPath: string) => void;
}

/** "Have a link or QR from your teacher?" sheet: scan, or paste an invite link. */
export function InviteSheet({ open, onOpenChange, onScan, onNavigate }: InviteSheetProps) {
  const [inviteLink, setInviteLink] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const enrollPath = buildEnrollPathFromInviteText(inviteLink);
    if (!enrollPath) {
      toast.error(t("classes.qrInvalid"));
      return;
    }
    onNavigate(enrollPath);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("classes.invite.sheetTitle")}
      description={t("classes.invite.sheetDescription")}
      onClosed={() => setInviteLink("")}
    >
      <Button id="btn-scan-qr" type="button" variant="brand" size="cta" className="w-full" onClick={onScan}>
        <ScanLine aria-hidden="true" />
        {t("classes.invite.scan")}
      </Button>

      <div className="my-5 flex items-center gap-3 text-[13px] leading-[1.5] text-fg-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-hairline" />
        {t("classes.invite.or")}
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextField
          id="input-invite-link"
          label={t("classes.invite.inputLabel")}
          placeholder={t("classes.invite.inputPlaceholder")}
          value={inviteLink}
          onChange={(event) => setInviteLink(event.target.value)}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <Button type="submit" variant="brandSoft" size="cta" className="w-full" disabled={!inviteLink.trim()}>
          {t("classes.invite.submit")}
        </Button>
      </form>
    </BottomSheet>
  );
}
