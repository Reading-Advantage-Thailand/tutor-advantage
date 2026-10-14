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
import { IconTile, type TileTone } from "@/components/app/Atoms";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { HELP_URL } from "@/components/app/constants";
import { t } from "@/lib/i18n";
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

/** Inline legal link with a ~44px hit area inside the sentence. */
const legalLinkClass =
  "-my-3 inline-block rounded-md py-3 font-semibold text-brand-fg underline decoration-brand-fg/40 underline-offset-4 hover:decoration-brand-fg";

function BenefitList({ variant }: { variant: "hero" | "card" }) {
  return (
    <ul className={cn("grid gap-2.5", variant === "hero" && "gap-3")}>
      {BENEFITS.map((benefit) => (
        <li
          key={benefit.label}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3",
            variant === "hero"
              ? "border-hero-ring bg-hero-chip"
              : "border-hairline bg-surface",
          )}
        >
          <IconTile
            icon={benefit.icon}
            tone={benefit.tone}
            size={variant === "hero" ? "md" : "sm"}
          />
          <span
            className={cn(
              "text-sm font-medium",
              variant === "hero" ? "text-hero-fg" : "text-fg",
            )}
          >
            {benefit.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Logged-out entry (middleware sends signed-in tutors to /dashboard).
 * Phones: compact mint hero, then the sign-in card, so the Google button sits
 * in the first viewport even at 360×640. lg+: split layout, benefits panel
 * on the left and the form centred on the right.
 */
export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-app text-fg lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Brand + value proposition */}
      <header className="bg-hero px-4 pt-[calc(var(--safe-top)+16px)] pb-12 text-hero-fg sm:px-8 sm:pb-14 lg:flex lg:min-h-dvh lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:mx-0 lg:max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <BrandLockup tone="hero" />
            <ThemeToggle className="text-hero-fg-muted hover:text-hero-fg lg:hidden" />
          </div>

          <div className="mt-6 max-w-xl sm:mt-8 lg:my-auto lg:py-12">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl lg:leading-tight">
              {t("app.loginHeroTitlePrefix")} {t("app.loginHeroTitleAccent")}
            </h1>
            <p className="mt-2 max-w-md text-[0.9375rem] text-hero-fg-muted sm:text-base lg:mt-4 lg:text-lg">
              {t("app.loginHeroLead")}
            </p>

            <div className="mt-10 hidden lg:block">
              <h2 className="mb-3 text-sm font-semibold text-hero-fg-muted">
                {t("app.loginBenefitsTitle")}
              </h2>
              <BenefitList variant="hero" />
            </div>
          </div>

          <p className="mt-auto hidden items-center gap-2 text-[0.8125rem] font-medium text-hero-fg-muted lg:flex">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {t("app.loginTrustSecure")}
          </p>
        </div>
      </header>

      {/* Sign-in */}
      <main className="relative -mt-6 rounded-t-2xl bg-app px-4 pt-6 pb-[calc(var(--safe-bottom)+32px)] sm:px-8 lg:mt-0 lg:flex lg:min-h-dvh lg:items-center lg:justify-center lg:rounded-none lg:bg-surface lg:px-12 lg:py-12">
        <ThemeToggle className="absolute top-6 right-6 hidden lg:inline-flex" />

        <div className="mx-auto w-full max-w-md lg:max-w-sm">
          <section
            aria-labelledby="login-title"
            className="rounded-xl border border-hairline bg-surface p-5 shadow-card sm:p-6 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
          >
            <h2
              id="login-title"
              className="text-xl font-bold tracking-tight lg:text-2xl"
            >
              {t("app.welcomeBack")}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {t("app.loginSubtitle")}
            </p>

            <div className="mt-5 lg:mt-8">
              <LoginForm />
            </div>

            <p className="mt-4 text-[0.8125rem] leading-relaxed text-fg-muted">
              {t("app.loginAgreementPrefix")}{" "}
              <Link href="/terms" className={legalLinkClass}>
                {t("app.termsOfService")}
              </Link>{" "}
              {t("app.and")}{" "}
              <Link href="/privacy" className={legalLinkClass}>
                {t("app.privacyPolicy")}
              </Link>
            </p>

            <p className="mt-5 flex items-start gap-2 border-t border-hairline pt-4 text-[0.8125rem] text-fg-muted lg:hidden">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-fg"
              />
              {t("app.loginTrustSecure")}
            </p>
          </section>

          <p className="mt-4 text-center text-[0.8125rem] text-fg-muted lg:mt-10 lg:text-left">
            {t("app.loginNeedHelp")}{" "}
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={legalLinkClass}
            >
              {t("app.contactTeam")}
            </a>
          </p>

          {/* Phones/tablets: benefits after the form (the hero shows them on lg+). */}
          <section aria-labelledby="benefits-title" className="mt-8 lg:hidden">
            <h2
              id="benefits-title"
              className="mb-3 text-sm font-semibold text-fg-muted"
            >
              {t("app.loginBenefitsTitle")}
            </h2>
            <BenefitList variant="card" />
          </section>
        </div>
      </main>
    </div>
  );
}
