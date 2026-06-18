"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import {
  QrCode,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ReferralLink({ referralLink }: { referralLink: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/60 h-full flex flex-col">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                ลิงก์เชิญนักเรียน
              </p>
              <p className="text-xs text-muted-foreground whitespace-normal leading-relaxed mt-0.5">
                {t("tutorClass.detail.referralHelp")}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full mt-auto pt-4">
            <div className="flex items-center gap-2 w-full">
              <input
                readOnly
                value={referralLink}
                className="flex-1 h-10 rounded-lg border border-input bg-muted px-3 text-xs text-foreground font-mono truncate"
              />
              <button
                onClick={handleCopy}
                id="btn-copy-referral"
                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-10 text-xs bg-background font-medium gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    {t("tutorClass.detail.showQr")}
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t("tutorClass.detail.qrTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("tutorClass.detail.qrDescription")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-4 space-y-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border/50">
                    <QRCodeSVG
                      value={referralLink}
                      size={220}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <div className="w-full flex">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleCopy}
                    >
                      {copied ? (
                         <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
