"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CircleCheck, CircleDashed, LockKeyhole, Pencil, ShieldCheck } from "lucide-react";
import {
  CardSkeleton,
  Chip,
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
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { payoutBlockText } from "../lib/documentExpiry";
import { stepCompletion, verificationSteps, type SettingsUser, type VerificationField } from "../lib/verification";
import { DocumentExpiryNotice } from "./DocumentExpiryNotice";
import { VerificationSummary } from "./VerificationSummary";

// The upload/edit forms only load when they are shown (never for a verified
// tutor who just views their data). React.lazy + Suspense rather than
// next/dynamic: next/dynamic renders an extra server-only sibling
// (PreloadChunks), which shifts every useId inside the forms and broke
// hydration of the consent checkboxes (Base UI ids).
const VerificationForms = lazy(() => import("./VerificationForms").then((m) => ({ default: m.VerificationForms })));

export const STEP_LABELS: Record<VerificationField, string> = {
  idCard: t("dashboardSettings.stepIdCard"),
  bankBook: t("dashboardSettings.stepBank"),
  address: t("dashboardSettings.stepAddress"),
  taxInfo: t("dashboardSettings.stepTax"),
  workPermit: t("dashboardSettings.stepWorkPermit"),
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

/**
 * Section #verify (patterns.md T8): the payout-account card (status tile,
 * status chip, steps progress and one chip per document), the privacy note,
 * then the document forms (editing) or the submitted data (verified).
 */
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
  const VERIFICATION_STEPS = verificationSteps(user);
  const doneCount = VERIFICATION_STEPS.filter((step) => steps[step]).length;
  const blockText = payoutBlockText(user.identity?.payoutBlock);

  return (
    <Section
      id="verify"
      title={t("dashboardSettings.verifySection")}
      description={t("dashboardSettings.verifySectionDescription")}
      className="scroll-mt-20"
    >
      <div ref={sectionRef} className="flex scroll-mt-24 flex-col gap-3">
        {blockText ? (
          <Notice tone="danger" role="alert">
            {blockText}
          </Notice>
        ) : null}

        <DocumentExpiryNotice identity={user.identity} />

        {highlighted ? (
          <Notice tone="brand" role="status">
            {t("dashboardSettings.highlightHint")}
          </Notice>
        ) : null}

        <Surface
          padding="none"
          className={cn(
            "overflow-hidden transition-shadow duration-(--duration-normal)",
            highlighted && "ring-2 ring-brand-fg ring-offset-2 ring-offset-app",
          )}
        >
          <div className="flex items-start gap-3 p-4 md:p-5">
            <IconTile icon={ShieldCheck} tone={statusTile(status)} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="type-card text-fg">{t("dashboardSettings.payoutStatusTitle")}</p>
              <p className="type-body-s text-fg-muted">{thaiCopy(statusText(status))}</p>
              <StatusChip status={status || "UNVERIFIED"} label={statusChipLabel(status)} className="mt-2" />
            </div>
            {isVerified && !isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="hidden sm:inline-flex">
                <Pencil aria-hidden="true" />
                {t("dashboardSettings.editVerification")}
              </Button>
            ) : null}
          </div>

          <div className="border-t border-hairline px-4 py-4 md:px-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-label text-fg-muted">{t("dashboardSettings.stepsProgress")}</span>
              <span className="text-sm font-semibold whitespace-nowrap text-fg tabular">
                {doneCount} / {VERIFICATION_STEPS.length} {t("dashboardSettings.stepsUnit")}
              </span>
            </div>
            <ProgressBar
              value={(doneCount / VERIFICATION_STEPS.length) * 100}
              label={t("dashboardSettings.stepsProgress")}
              className="mt-2"
            />
            <ol className="mt-3 flex flex-wrap gap-2">
              {VERIFICATION_STEPS.map((step) => (
                <li key={step} className="max-w-full">
                  <Chip tone={steps[step] ? "success" : "neutral"} icon={steps[step] ? CircleCheck : CircleDashed}>
                    {step === "idCard" && user.identity?.idType === "PASSPORT" ? t("dashboardSettings.stepPassport") : STEP_LABELS[step]}
                  </Chip>
                </li>
              ))}
            </ol>
            {isVerified && !isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)} className="mt-4 w-full sm:hidden">
                <Pencil aria-hidden="true" />
                {t("dashboardSettings.editVerification")}
              </Button>
            ) : null}
          </div>
        </Surface>

        <Notice tone="info" icon={LockKeyhole} title={t("dashboardSettings.kycPrivacyTitle")}>
          {t("dashboardSettings.kycPrivacyBody")}
        </Notice>

        {isEditing ? (
          <Suspense fallback={<CardSkeleton lines={5} />}>
            <VerificationForms user={user} onCancelEdit={isVerified ? () => setIsEditing(false) : undefined} />
          </Suspense>
        ) : (
          <VerificationSummary user={user} />
        )}
      </div>
    </Section>
  );
}
