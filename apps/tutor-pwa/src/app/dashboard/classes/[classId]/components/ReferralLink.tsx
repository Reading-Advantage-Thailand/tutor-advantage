"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { QrCode, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

export function ReferralLink({
  referralLink,
  className,
}: {
  referralLink: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card
      className={cn(
        "h-full min-h-[220px] rounded-2xl border-border/60 bg-card/95 shadow-sm",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <QrCode className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {t("tutorClass.detail.referralTitle")}
              </p>
              <p className="mt-0.5 whitespace-normal text-xs leading-relaxed text-muted-foreground">
                {t("tutorClass.detail.referralHelp")}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-emerald-500/20 bg-white p-4 shadow-sm">
            <QRCodeSVG
              value={referralLink}
              size={176}
              level="M"
              includeMargin={true}
            />
          </div>

          <div className="mt-4 flex w-full flex-col gap-2 border-t border-border/50 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tutorClass.detail.copy")}
            </p>
            <div className="flex w-full items-center gap-2">
              <input
                readOnly
                value={referralLink}
                className="h-9 flex-1 truncate rounded-lg border border-input bg-muted px-3 font-mono text-xs text-foreground"
              />
              <button
                onClick={handleCopy}
                id="btn-copy-referral"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input transition-colors hover:bg-muted"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-full gap-2 border-emerald-600 bg-background text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
              onClick={handleCopy}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied
                ? t("tutorClass.detail.copied")
                : t("tutorClass.detail.copy")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
