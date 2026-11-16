import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  QrCode,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { LoginForm } from "@/components/auth/login-form";
import { getLoginError } from "@/components/auth/login-error";
import { IconTile, type TileTone } from "@/components/app/Atoms";
import { Notice } from "@/components/app/Feedback";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { HELP_URL } from "@/components/app/constants";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: t("app.loginTitle"),
  description: t("app.loginDescription"),
};

const BENEFITS: { icon: LucideIcon; tone: TileTone; label: string }[] = [
  { icon: BookOpenCheck, tone: "brand", label: t("app.loginBenefitLessons") },
  { icon: BarChart3, tone: "teal", label: t("app.loginBenefitEarnings") },
  { icon: QrCode, tone: "blue", label: t("app.loginBenefitReferral") },
];

/** Link standing alone at the end of its line: padded to a ~44px tall hit area. */
const legalLinkClass =
  "-my-3 inline-block rounded-md py-3 font-semibold text-brand-fg underline decoration-brand-fg/40 underline-offset-4 hover:decoration-brand-fg";
/**
 * Link inside the agreement sentence: plain inline. A padded inline-block is
 * taller than the line, so where the sentence wraps (320px) the lower link
 * covered the upper one and taps opened the wrong page. Each link stays on
 * one line: the browser splits "นโยบายความเป็น / ส่วนตัว" otherwise.
 */
const sentenceLinkClass =
  "rounded-sm font-semibold whitespace-nowrap text-brand-fg underline decoration-brand-fg/40 underline-offset-4 hover:decoration-brand-fg";

/** The three benefits as one rimmed card of divided rows (informational, not tappable). */
function BenefitCard({ className }: { className?: string }) {
  return (
    <ul className={cn("ds-card overflow-hidden", className)}>
      {BENEFITS.map((benefit, index) => (
        <li
          key={benefit.label}
          className={cn("flex min-h-16 items-center gap-3 px-4 py-3", index > 0 && "border-t border-hairline")}
        >
          <IconTile icon={benefit.icon} tone={benefit.tone} />
          <span className="min-w-0 type-body text-fg">{thaiCopy(benefit.label)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Logged-out entry (middleware sends signed-in tutors to /dashboard).
 * Redesign 2026-11, the tutor family on paper:
 * - Phones: a flat jade-tint hero (brand row, Kodchasan headline, lead), the
 *   sign-in card lifted over its edge so the Google button sits in the first
 *   viewport even at 360×640, then the benefits as one card of rows.
 * - ≥ 1024: one centred stage on paper: brand row across the top, headline +
 *   benefits on the left, the raised sign-in card on the right.
 * One h1 for every width (the hero block is re-placed with `lg:contents`).
 * `?error=` from a failed sign-in shows as a notice above the button.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const loginError = getLoginError((await searchParams).error);

  return (
    <div className="min-h-dvh bg-app text-fg">
      <div className="mx-auto flex w-full flex-col lg:grid lg:min-h-dvh lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:px-10 xl:gap-x-24">
        {/* Hero (phones) — on lg its two children join the page grid. */}
        <div className="rounded-b-[28px] bg-hero-bg-base px-4 pt-[calc(var(--safe-top)+12px)] pb-14 text-hero-fg sm:px-8 lg:contents">
          <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 lg:col-span-2 lg:row-start-1 lg:max-w-none lg:pt-[calc(var(--safe-top)+24px)]">
            <BrandLockup tone="hero" className="lg:hidden" />
            <BrandLockup className="hidden lg:flex" />
            <ThemeToggle className="text-hero-fg-muted hover:text-hero-fg lg:text-fg-muted lg:hover:text-fg" />
          </header>

          <div className="mx-auto mt-7 w-full max-w-md lg:col-start-1 lg:row-start-2 lg:mx-0 lg:mt-0 lg:max-w-none lg:self-center lg:py-12">
            <h1 className="font-heading text-[1.75rem] leading-[1.3] font-semibold text-balance-th lg:text-[2.75rem] lg:leading-[1.3] lg:text-fg">
              <span className="whitespace-nowrap">{t("app.loginHeroTitlePrefix")}</span>{" "}
              <br className="hidden lg:inline" />
              <span className="whitespace-nowrap lg:text-brand-fg">{t("app.loginHeroTitleAccent")}</span>
            </h1>
            <p className="mt-2 type-body text-hero-fg-muted lg:mt-4 lg:max-w-lg lg:text-lg lg:leading-[1.6] lg:text-fg-muted">
              {thaiCopy(t("app.loginHeroLead"))}
            </p>

            <div className="hidden lg:block">
              <h2 className="mt-10 mb-3 type-section text-fg">{t("app.loginBenefitsTitle")}</h2>
              <BenefitCard className="max-w-lg" />
              <p className="mt-6 flex items-center gap-2 type-body-s text-fg-muted">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-brand-fg" />
                <span className="min-w-0">{thaiCopy(t("app.loginTrustSecure"))}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Sign-in (phones: lifted over the hero's edge). */}
        <main className="relative -mt-9 px-4 sm:px-8 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:self-center lg:px-0 lg:py-12">
          <div className="mx-auto w-full max-w-md">
            <section
              aria-labelledby="login-title"
              className="ds-card px-5 pt-6 pb-5 sm:px-7 sm:pt-7 lg:px-8 lg:pt-8 lg:pb-7 lg:shadow-raised"
            >
              <h2 id="login-title" className="font-heading text-[1.375rem] leading-[1.35] font-semibold text-fg">
                {t("app.welcomeBack")}
              </h2>
              <p className="mt-1 type-body-s text-fg-muted">{t("app.loginSubtitle")}</p>

              <div className="mt-6 grid gap-4">
                {loginError ? (
                  <Notice tone={loginError.tone} role="alert">
                    {loginError.message}
                  </Notice>
                ) : null}
                <LoginForm />
              </div>

              <p className="mt-4 text-[0.8125rem] leading-[1.9] text-fg-muted">
                {t("app.loginAgreementPrefix")}{" "}
                <Link href="/terms" className={sentenceLinkClass}>
                  {t("app.termsOfService")}
                </Link>{" "}
                {t("app.and")}{" "}
                <Link href="/privacy" className={sentenceLinkClass}>
                  {t("app.privacyPolicy")}
                </Link>
              </p>

              <p className="mt-5 flex items-start gap-2 border-t border-hairline pt-4 type-body-s text-fg-muted lg:hidden">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-fg" />
                <span className="min-w-0">{thaiCopy(t("app.loginTrustSecure"))}</span>
              </p>
            </section>

            <p className="mt-4 text-center type-body-s text-fg-muted">
              {t("app.loginNeedHelp")}{" "}
              <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className={legalLinkClass}>
                {t("app.contactTeam")}
              </a>
            </p>
          </div>
        </main>

        {/* Phones/tablets: benefits after the form (the left column shows them on lg+). */}
        <section
          aria-labelledby="benefits-title"
          className="mx-auto mt-8 w-full max-w-md px-4 pb-[calc(var(--safe-bottom)+32px)] sm:max-w-[calc(28rem+4rem)] sm:px-8 lg:hidden"
        >
          <h2 id="benefits-title" className="mb-2 type-section text-fg">
            {t("app.loginBenefitsTitle")}
          </h2>
          <BenefitCard />
        </section>
      </div>
    </div>
  );
}
