"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PartyPopper, Save, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AppBar,
  BottomActionBar,
  IconTile,
  Screen,
  StatusScreen,
  Surface,
  TextField,
  useBackNavigation,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { AgreementCheck, GuardianFaq, RelationPicker, StepCard } from "./_components/GuardianFormParts";
import { GuardianSkeleton } from "./_components/GuardianSkeleton";
import { getGuardianErrorKey, hasErrors, validateGuardianForm, type GuardianFormErrors } from "./_lib/form";

const FORM_ID = "guardian-form";
const guardianConsentKey = (userId: string) => `${userId}:guardianConsent`;
/** After saving, go back to Profile on our own after this long (as before). */
const SUCCESS_REDIRECT_MS = 2000;

export default function GuardianPage() {
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;
  const goBack = useBackNavigation("/profile");

  // Already given? (Saving again would not change anything on the server.)
  const consent = useCachedResource<{ hasConsent?: boolean }>(
    userId ? guardianConsentKey(userId) : null,
    () => studentApi.checkGuardianConsent(),
    { enabled: isReady },
  );

  const [guardianName, setGuardianName] = useState("");
  const [relation, setRelation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<GuardianFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const relationRef = useRef<HTMLInputElement>(null);

  // Leave exactly once (auto-redirect timer or the button, whichever is first).
  const leftRef = useRef(false);
  const leave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    goBack();
  }, [goBack]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(leave, SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [success, leave]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors = validateGuardianForm({ guardianName, relation, agreed });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      if (nextErrors.guardianName) nameRef.current?.focus();
      else if (nextErrors.relation) relationRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await studentApi.submitGuardianConsent(guardianName, relation);
      consent.mutate({ hasConsent: true });
      // Other cached screens show the guardian status too (e.g. "my consents",
      // where back usually returns to): mark them stale so they refetch.
      if (userId) {
        const consentKey = guardianConsentKey(userId);
        invalidateResource((key) => key.startsWith(`${userId}:`) && key !== consentKey);
      }
      setSuccess(true);
    } catch (err) {
      console.warn("Failed to submit guardian info:", err);
      toast.error(t(getGuardianErrorKey(err)));
    } finally {
      setSaving(false);
    }
  };

  if (!isReady || consent.isLoading) return <GuardianSkeleton />;

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("guardian.title")} back fallbackHref="/profile" />
        <LiffErrorState />
      </Screen>
    );
  }

  if (success) {
    return (
      <Screen>
        <AppBar title={t("guardian.title")} back fallbackHref="/profile" onBack={leave} />
        <StatusScreen
          icon={PartyPopper}
          mascot="cheer"
          title={t("guardian.savedTitle")}
          description={t("guardian.savedDescription")}
          primaryAction={
            <Button variant="brand" size="cta" className="w-full" onClick={leave}>
              {t("guardian.backToProfile")}
            </Button>
          }
        />
      </Screen>
    );
  }

  // A failed status check never blocks the form.
  if (consent.data?.hasConsent) {
    return (
      <Screen>
        <AppBar title={t("guardian.title")} back fallbackHref="/profile" />
        <StatusScreen
          icon={ShieldCheck}
          title={t("guardian.alreadyGivenTitle")}
          description={t("guardian.alreadyGivenDescription")}
          primaryAction={
            <Button variant="brand" size="cta" className="w-full" onClick={goBack}>
              {t("guardian.backToProfile")}
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={t("guardian.title")} back fallbackHref="/profile" />

      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pt-2 pb-6">
        <Surface tone="brand" className="flex items-start gap-3">
          <IconTile icon={Users} tone="pink" size="lg" />
          <div className="min-w-0">
            <p className="text-[15px] leading-[1.5] font-bold text-fg">{t("guardian.subtitle")}</p>
            <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{t("guardian.intro")}</p>
          </div>
        </Surface>

        <StepCard step={1}>
          <TextField
            ref={nameRef}
            label={t("guardian.nameLabel")}
            placeholder={t("guardian.namePlaceholder")}
            autoComplete="name"
            enterKeyHint="next"
            required
            value={guardianName}
            onChange={(event) => {
              setGuardianName(event.target.value);
              if (errors.guardianName) setErrors((prev) => ({ ...prev, guardianName: undefined }));
            }}
            error={errors.guardianName ? t(errors.guardianName) : undefined}
          />
        </StepCard>

        <StepCard step={2}>
          <RelationPicker
            value={relation}
            onChange={(value) => {
              setRelation(value);
              if (errors.relation) setErrors((prev) => ({ ...prev, relation: undefined }));
            }}
            error={errors.relation ? t(errors.relation) : undefined}
            firstOptionRef={relationRef}
          />
        </StepCard>

        <StepCard step={3}>
          <p className="text-sm leading-[1.5] font-semibold text-fg">{t("guardian.confirmLabel")}</p>
          <AgreementCheck
            checked={agreed}
            onChange={(checked) => {
              setAgreed(checked);
              if (errors.agreed) setErrors((prev) => ({ ...prev, agreed: undefined }));
            }}
            showHint={!agreed}
            invalid={Boolean(errors.agreed)}
          />
        </StepCard>

        <GuardianFaq />
      </form>

      <BottomActionBar>
        <Button
          type="submit"
          form={FORM_ID}
          variant="brand"
          size="cta"
          className="flex-1"
          loading={saving}
          disabled={!agreed}
        >
          {saving ? null : <Save aria-hidden="true" />}
          {saving ? t("guardian.saving") : t("guardian.save")}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
