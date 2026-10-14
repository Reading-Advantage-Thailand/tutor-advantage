"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// Relative imports: this hook is unit-tested and the root vitest config maps "@" to another app.
import { studentApi } from "../../../lib/api";
import { t } from "../../../lib/i18n";
import type { Enrollment } from "../../../lib/enrollmentStatus";
import { copyTextToClipboard } from "./clipboard";

export interface ReferralInvite {
  url: string;
  className: string;
}

export interface ReferralInviteState {
  /** Class picker sheet (more than one shareable class). */
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  /** QR sheet. `invite` stays set until the sheet finished closing. */
  qrOpen: boolean;
  setQrOpen: (open: boolean) => void;
  invite: ReferralInvite | null;
  /** Call from the sheet's onClosed. */
  clearInvite: () => void;
  /** A share link is being created (undefined = idle; null = request without a class id). */
  loadingClassId: string | null | undefined;
  busy: boolean;
  /** "ชวนเพื่อน" tapped: toast (no class), picker (several) or straight to the QR (one). */
  start: () => void;
  /** Create the share link for one class and show its QR. */
  openForClass: (classId?: string) => Promise<void>;
  /** Copy the invite link (toast on success/failure). */
  copyLink: () => Promise<void>;
  /** Link was copied in the last 2.5 s (button shows a check). */
  copied: boolean;
}

const COPIED_RESET_MS = 2500;

/**
 * Invite-a-friend flow from Home (unchanged rules): POST /student/share-link
 * {classId} → QR sheet with the returned url; copy uses the Clipboard API with
 * the execCommand fallback. One request at a time.
 */
export function useReferralInvite(shareableClasses: Enrollment[]): ReferralInviteState {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [invite, setInvite] = useState<ReferralInvite | null>(null);
  const [loadingClassId, setLoadingClassId] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);
  const copyBusyRef = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const openForClass = useCallback(
    async (classId?: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLoadingClassId(classId ?? null);
      try {
        const data = (await studentApi.generateShareLink(classId)) as { url?: string } | null;
        if (!data?.url) throw new Error("share link without url");
        const selectedClass = shareableClasses.find((cls) => cls.id === classId);
        setInvite({ url: data.url, className: selectedClass?.name ?? "" });
        setCopied(false);
        setPickerOpen(false);
        setQrOpen(true);
      } catch {
        toast.error(t("dashboard.referralFailed"));
      } finally {
        busyRef.current = false;
        setLoadingClassId(undefined);
      }
    },
    [shareableClasses],
  );

  const start = useCallback(() => {
    if (busyRef.current) return;
    if (shareableClasses.length === 0) {
      toast.info(t("dashboard.referralNoClass"));
      return;
    }
    if (shareableClasses.length > 1) {
      setPickerOpen(true);
      return;
    }
    void openForClass(shareableClasses[0]?.id);
  }, [openForClass, shareableClasses]);

  const copyLink = useCallback(async () => {
    if (!invite || copyBusyRef.current) return;
    copyBusyRef.current = true;
    try {
      await copyTextToClipboard(invite.url);
      setCopied(true);
      toast.success(t("dashboard.referralCopied"));
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      toast.error(t("dashboard.copyFailed"));
    } finally {
      copyBusyRef.current = false;
    }
  }, [invite]);

  const clearInvite = useCallback(() => {
    setInvite(null);
    setCopied(false);
  }, []);

  return {
    pickerOpen,
    setPickerOpen,
    qrOpen,
    setQrOpen,
    invite,
    clearInvite,
    loadingClassId,
    busy: loadingClassId !== undefined,
    start,
    openForClass,
    copyLink,
    copied,
  };
}
