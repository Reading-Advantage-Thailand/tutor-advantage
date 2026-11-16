"use client";

import { ShieldCheck } from "lucide-react";
import { AppBar, BottomActionBar, IconTile, Notice, Screen, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { PaymentStepCaption } from "./PaymentStepCaption";
import { ThaiText } from "./ThaiText";

export interface AgeCheckStepProps {
  dateOfBirth: string;
  onDateOfBirthChange: (value: string) => void;
  /** Minor without recorded consent: guardian fields are shown and required. */
  needsGuardian: boolean;
  guardianName: string;
  onGuardianNameChange: (value: string) => void;
  guardianRelation: string;
  onGuardianRelationChange: (value: string) => void;
  canSubmit: boolean;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

/** PDPA age check (and guardian consent for under-18s) before paying. */
export function AgeCheckStep({
  dateOfBirth,
  onDateOfBirthChange,
  needsGuardian,
  guardianName,
  onGuardianNameChange,
  guardianRelation,
  onGuardianRelationChange,
  canSubmit,
  loading,
  onSubmit,
  onBack,
}: AgeCheckStepProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Screen>
      <AppBar title={t("payment.ageCheck.title")} onBack={onBack} />
      <PaymentStepCaption step={2} />
      <form
        id="payment-age-form"
        className="flex flex-col gap-5 px-4 pt-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit && !loading) onSubmit();
        }}
      >
        <div className="flex items-center gap-4">
          <IconTile icon={ShieldCheck} tone="brand" size="lg" />
          <div className="min-w-0">
            <h2 className="t-title text-fg">{t("payment.ageCheck.pdpaTitle")}</h2>
            <p className="text-sm leading-[1.6] text-fg-muted">
              <ThaiText text={t("payment.ageCheck.pdpaSubtitle")} />
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]">
          <TextField
            type="date"
            autoComplete="bday"
            label={t("payment.ageCheck.dateOfBirthLabel")}
            hint={t("payment.ageCheck.dateOfBirthHint")}
            value={dateOfBirth}
            max={today}
            onChange={(event) => onDateOfBirthChange(event.target.value)}
            enterKeyHint="next"
          />

          {needsGuardian ? (
            <div className="flex flex-col gap-4 border-t-[1.5px] border-hairline pt-5">
              <Notice
                tone="warning"
                title={<ThaiText text={t("payment.ageCheck.guardianNotice")} />}
                description={<ThaiText text={t("payment.ageCheck.guardianInstruction")} />}
              />
              <TextField
                label={t("payment.ageCheck.guardianNameLabel")}
                placeholder={t("payment.ageCheck.guardianNamePlaceholder")}
                value={guardianName}
                onChange={(event) => onGuardianNameChange(event.target.value)}
                autoComplete="name"
                enterKeyHint="next"
                required
              />
              <TextField
                label={t("payment.ageCheck.guardianRelationLabel")}
                placeholder={t("payment.ageCheck.guardianRelationPlaceholder")}
                value={guardianRelation}
                onChange={(event) => onGuardianRelationChange(event.target.value)}
                enterKeyHint="done"
                required
              />
            </div>
          ) : null}
        </div>
      </form>

      <BottomActionBar>
        <Button
          id="btn-submit-age-check"
          type="submit"
          form="payment-age-form"
          variant="brand"
          size="cta-lg"
          className="flex-1"
          disabled={!canSubmit}
          loading={loading}
        >
          {loading ? t("payment.ageCheck.saving") : t("payment.ageCheck.continuePayment")}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
