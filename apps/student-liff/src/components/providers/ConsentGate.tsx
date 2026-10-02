"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, FileText, Shield, ShieldCheck } from "lucide-react";
import { AppBar } from "@/components/mobile/AppBar";
import { BottomActionBar } from "@/components/mobile/Feedback";
import { IconTile, type IconTileTone } from "@/components/mobile/IconTile";
import { LegalSections, type LegalSection } from "@/components/legal/LegalSections";
import { postTermsConsent } from "@/components/legal/consent";
import { Button } from "@/components/ui/button";
import { studentLegalCopy } from "@/lib/content/legal";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Full-screen PDPA consent wall (lazy-loaded by ConsentProvider only for
 * students without TERMS_AND_PRIVACY consent). It replaces the whole app, so
 * the full documents expand inline instead of linking to /privacy and /terms.
 */
export default function ConsentGate() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);

    const result = await postTermsConsent();
    if (result === "ok") {
      // The root layout re-reads the consent and renders the app (keep the button busy until then).
      router.refresh();
      return;
    }
    setError(result === "network" ? t("common.networkError") : t("consentGate.saveFailed"));
    setSubmitting(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-gate-title"
      className="fixed inset-0 z-[var(--z-consent)] flex flex-col overflow-y-auto overscroll-contain bg-app"
    >
      <AppBar title={t("consentGate.appBarTitle")} />

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-6">
        <div className="flex flex-col items-center text-center">
          <IconTile icon={ShieldCheck} tone="brand" size="lg" shape="circle" className="size-16 [&>svg]:size-8" />
          <h2 id="consent-gate-title" className="mt-4 text-xl leading-[1.45] font-extrabold text-fg">
            {t("consentGate.title")}
          </h2>
          <p className="mt-2 max-w-[340px] text-[15px] leading-[1.6] text-fg-muted">{t("consentGate.intro")}</p>
        </div>

        {/* Summary */}
        <div className="mt-6 rounded-[var(--radius-card)] border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <h3 className="text-[17px] leading-[1.5] font-bold text-fg">{t("consentGate.privacyHeading")}</h3>
          <p className="mt-2 text-base leading-[1.7] text-fg">{t("consentGate.privacyBody")}</p>
          <h3 className="mt-6 text-[17px] leading-[1.5] font-bold text-fg">{t("consentGate.termsHeading")}</h3>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 text-base leading-[1.7] text-fg marker:font-semibold marker:text-fg-muted">
            <li>{t("consentGate.termsItem1")}</li>
            <li>{t("consentGate.termsItem2")}</li>
            <li>{t("consentGate.termsItem3")}</li>
          </ol>
        </div>

        {/* Full documents, expandable in place */}
        <section className="mt-6" aria-labelledby="consent-gate-docs">
          <h3 id="consent-gate-docs" className="px-4 pb-2 text-[13px] leading-[1.5] font-semibold text-fg-muted">
            {t("consentGate.fullDocsHeader")}
          </h3>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
            <DocumentDisclosure
              icon={Shield}
              tone="brand"
              label={t("consentGate.readFullPrivacy")}
              intro={studentLegalCopy.privacy.intro}
              sections={studentLegalCopy.privacy.sections}
            />
            <DocumentDisclosure
              icon={FileText}
              tone="blue"
              label={t("consentGate.readFullTerms")}
              intro={studentLegalCopy.terms.intro}
              sections={studentLegalCopy.terms.sections}
            />
          </div>
          <p className="px-4 pt-2 text-xs leading-[1.5] text-fg-muted">{t("consentGate.laterNote")}</p>
        </section>
      </div>

      <BottomActionBar>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <label
            className={cn(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors select-none active:bg-press",
              "has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-brand-500/40",
              agreed ? "border-brand-soft-border bg-brand-soft" : "border-hairline bg-surface",
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={agreed}
              onChange={(event) => {
                setAgreed(event.target.checked);
                setError(null);
              }}
              disabled={submitting}
            />
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                agreed ? "border-brand-solid bg-brand-solid text-white" : "border-field-border bg-surface",
              )}
            >
              {agreed ? <Check className="size-4" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-[1.5] font-semibold text-fg">{t("consentGate.agreeLabel")}</span>
              <span className="mt-0.5 block text-[13px] leading-[1.5] text-fg-muted">{t("consentGate.agreeHint")}</span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-center text-sm leading-[1.5] font-semibold text-danger-fg">
              {error}
            </p>
          ) : null}

          <Button
            variant="brand"
            size="cta"
            className="w-full"
            onClick={handleAgree}
            disabled={!agreed}
            loading={submitting}
          >
            {t("consentGate.submit")}
          </Button>
        </div>
      </BottomActionBar>
    </div>
  );
}

interface DocumentDisclosureProps {
  icon: LucideIcon;
  tone: IconTileTone;
  label: string;
  intro: string;
  sections: readonly LegalSection[];
}

/** List-row styled <details> that expands a full legal document inline. */
function DocumentDisclosure({ icon, tone, label, intro, sections }: DocumentDisclosureProps) {
  return (
    <details className="list-row group" data-leading="">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition-colors select-none active:bg-press focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
        <IconTile icon={icon} tone={tone} />
        <span className="min-w-0 flex-1 text-[15px] leading-[1.5] font-semibold text-fg">{label}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-hairline px-4 pt-4 pb-5">
        <p className="text-base leading-[1.7] font-medium text-fg">{intro}</p>
        <LegalSections sections={sections} headingLevel="h4" className="mt-5" />
      </div>
    </details>
  );
}
