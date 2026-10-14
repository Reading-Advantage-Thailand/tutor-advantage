"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/app";
import { t } from "@/lib/i18n";

/** Clipboard copy with a 2s "copied" state (and a toast when the API is unavailable). */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("tutorClass.ui.copyFailed"));
    }
  };
  return { copied, copy };
}
