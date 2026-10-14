"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Check, Pencil, ShieldCheck } from "lucide-react";
import {
  CardSkeleton,
  IconTile,
  Notice,
  ProgressBar,
  Section,
  StatusChip,
  Surface,
  type TileTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { VERIFICATION_STEPS, stepCompletion, type SettingsUser, type VerificationField } from "../lib/verification";
import { VerificationSummary } from "./VerificationSummary";

// The upload/edit forms only load when they are shown (never for a verified
// tutor who just views their data).
const VerificationForms = dynamic(() => import("./VerificationForms").then((m) => m.VerificationForms), {
  loading: () => <CardSkeleton lines={5} />,
});

export const STEP_LABELS: Record<VerificationField, string> = {
  idCard: t("dashboardSettings.stepIdCard"),
  bankBook: t("dashboardSettings.stepBank"),
  address: t("dashboardSettings.stepAddress"),
  taxInfo: t("dashboardSettings.stepTax"),
};

function statusText(status: string | undefined) {
  if (status === "VERIFIED") return t("dashboardSettings.verifiedStatusRow");
  if (status === "PENDING") return t("dashboardSettings.payoutPending");
  if (status === "REJECTED") return t("dashboardSettings.payoutRejected");
  return t("dashboardSettings.payoutUnverified");
}

function statusTile(status: string | undefined): TileTone {
  if (status === "VERIFIED") return "brand";
  if (status === "REJECTED") return "red";
  if (status === "PENDING") return "blue";
  return "amber";
}

function statusChipLabel(status: string | undefined) {
  if (status === "VERIFIED") return t("dashboardSettings.verified");
  if (status === "PENDING") return t("dashboardSettings.pending");
  if (status === "REJECTED") return t("dashboardSettings.rejected");
  return t("dashboardSettings.unverified");
}

/** Section #verify: payout account status, progress and the document forms. */
export function VerificationSection({ user }: { user: SettingsUser }) {
  const status = user.verificationStatus;
  const isVerified = status === "VERIFIED";
  const [isEditing, setIsEditing] = useState(!isVerified);
  const [highlighted, setHighlighted] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsEditing(user.verificationStatus !== "VERIFIED");
  }, [user.verificationStatus]);

  // Deep link from earnings ("ไปกรอกข้อมูล") → /dashboard/settings#verify
  useEffect(() => {
    let timer: number | undefined;
    const check = () => {
      if (window.location.hash !== "#verify") return;
      setHighlighted(true);
      sectionRef.current?.scrollIntoView({ block: "start" });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHighlighted(false), 3000);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => {
      window.removeEventListener("hashchange", check);
      window.clearTimeout(timer);
    };
  }, []);

  const steps = stepCompletion(user);
  const doneCount = VERIFICATION_STEPS.filter((step) => steps[step]).length;

  return (
    <Section
      id="verify"
      title={t("dashboardSettings.verifySection")}
      description={t("dashboardSettings.verifySectionDescription")}
      className="scroll-mt-20"
    >
      <div ref={sectionRef} className="flex scroll-mt-24 flex-col gap-3">
        {highlighted ? (
          <Notice tone="brand" role="status">
            {t("dashboardSettings.highlightHint")}
          </Notice>
        ) : null}

        <Surface
          padding="md"
          className={cn("transition-shadow", highlighted && "ring-2 ring-brand-500/60 ring-offset-2 ring-offset-app")}
        >
          <div className="flex items-start gap-3">
            <IconTile icon={ShieldCheck} tone={statusTile(status)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[0.9375rem] font-semibold text-fg">{t("dashboardSettings.payoutStatusTitle")}</p>
                <StatusChip status={status || "UNVERIFIED"} label={statusChipLabel(status)} size="sm" />
              </div>
              <p className="mt-0.5 text-sm text-fg-muted">{statusText(status)}</p>
            </div>
            {isVerified && !isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="hidden sm:inline-flex">
                <Pencil aria-hidden="true" />
                {t("dashboardSettings.editVerification")}
              </Button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="text-fg-muted">{t("dashboardSettings.stepsProgress")}</span>
              <span className="font-semibold text-fg tabular">
                {doneCount} / {VERIFICATION_STEPS.length} {t("dashboardSettings.stepsUnit")}
              </span>
            </div>
            <ProgressBar
              value={(doneCount / VERIFICATION_STEPS.length) * 100}
              size="sm"
              label={t("dashboardSettings.stepsProgress")}
            />
            <ol className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
              {VERIFICATION_STEPS.map((step) => (
                <li
                  key={step}
                  className={cn("flex items-center gap-1.5 text-[0.8125rem]", steps[step] ? "text-fg" : "text-fg-muted")}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                      steps[step] ? "bg-brand-solid text-on-brand" : "border border-hairline-strong",
                    )}
                  >
                    {steps[step] ? <Check className="size-3" /> : null}
                  </span>
                  {STEP_LABELS[step]}
                </li>
              ))}
            </ol>
          </div>

          {isVerified && !isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)} className="mt-4 w-full sm:hidden">
              <Pencil aria-hidden="true" />
              {t("dashboardSettings.editVerification")}
            </Button>
          ) : null}
        </Surface>

        {isEditing ? (
          <VerificationForms user={user} onCancelEdit={isVerified ? () => setIsEditing(false) : undefined} />
        ) : (
          <VerificationSummary user={user} />
        )}
      </div>
    </Section>
  );
}
