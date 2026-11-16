"use client";

import Link from "next/link";
import { ChevronRight, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";
import { Chip, Screen, SectionHeader } from "@/components/mobile";
import { BrandMark } from "@/components/icons/BrandMark";
import { LineIcon } from "@/components/icons/LineIcon";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { PublicCatalogPreview } from "@/components/courses/PublicCatalogPreview";
import { BusinessContactCard } from "@/components/legal/BusinessContactCard";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "app.stepLinkTitle", desc: "app.stepLinkDesc", tone: "bg-tile-brand text-icon-brand" },
  { title: "app.stepPayTitle", desc: "app.stepPayDesc", tone: "bg-tile-blue text-icon-blue" },
  { title: "app.stepStartTitle", desc: "app.stepStartDesc", tone: "bg-tile-purple text-icon-purple" },
] as const;

/** Container card: rim + soft shadow, no ledge. */
const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/** The one sunshine marker under "ติวเตอร์" (a text highlight, not a surface). */
const markClass =
  "bg-[linear-gradient(transparent_62%,var(--highlight-mark)_62%,var(--highlight-mark)_92%,transparent_92%)] px-0.5";

const legalLinkClass =
  "flex min-h-11 items-center rounded-[var(--radius-ctl-sm)] px-3 font-heading text-sm leading-[1.4] font-semibold text-fg-muted active:bg-press";

export interface LandingMarketingProps {
  /** LINE-logged-in (rare here: logged-in users are redirected). Switches the CTAs to the dashboard. */
  isLoggedIn: boolean;
}

/**
 * LINE login (LINE's own button) or, when already logged in, the jade primary to the dashboard.
 * `tone="soft"` renders the logged-in button tonal (brandSoft), so a repeat of the CTA lower on
 * the page never makes a second primary action.
 */
function EntryCta({
  id,
  href,
  label,
  isLoggedIn,
  tone = "primary",
}: {
  id: string;
  href: string;
  label: string;
  isLoggedIn: boolean;
  tone?: "primary" | "soft";
}) {
  return isLoggedIn ? (
    <Link
      href={href}
      id={id}
      className={cn(buttonVariants({ variant: tone === "soft" ? "brandSoft" : "brand", size: "cta-lg" }), "w-full")}
    >
      <LayoutDashboard aria-hidden="true" />
      {label}
    </Link>
  ) : (
    <Link href={href} id={id} className={cn(buttonVariants({ variant: "line", size: "cta" }), "w-full")}>
      <LineIcon variant="mono" size={34} />
      {label}
    </Link>
  );
}

/**
 * Marketing page for regular browsers that are not logged in (patterns.md
 * S2). Code-split from "/" so the LIFF entry (inside LINE) only ships the
 * splash. Brand row → hero on paper (chip, three authored headline lines with
 * the one sunshine marker, lead, Reedy cheer) → LINE button, outline "ดูคลาส…",
 * trust line → facts strip and live catalogue → steps → product details →
 * closing LINE card → footer.
 */
export function LandingMarketing({ isLoggedIn }: LandingMarketingProps) {
  const ctaHref = isLoggedIn ? "/dashboard" : "/login";
  const ctaLabel = isLoggedIn ? t("app.goDashboard") : t("app.lineLogin");

  return (
    <Screen>
      {/* ── Brand row ── */}
      <header className="pt-[var(--safe-top)]">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-2.5 px-4">
          <BrandMark size="smd" />
          <span className="font-heading text-lg leading-[1.3] font-bold text-fg">{t("entry.brandName")}</span>
        </div>
      </header>

      {/* ── Hero on paper (two decorative blobs, never sunshine) ── */}
      <section aria-labelledby="landing-title" className="relative overflow-hidden">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-10 -right-[92px] size-[230px] rounded-full bg-hero-blob-a opacity-55 sm:right-[calc(50%-420px)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-[250px] -left-[60px] size-[120px] rounded-full bg-hero-blob-b opacity-55 sm:left-[calc(50%-400px)]"
        />
        <div className="relative mx-auto w-full max-w-2xl px-4 pt-1">
          {/* Under 375px the long programme name drops to the chip's small size (reading face 12). */}
          <Chip tone="brand" size="md" narrowSize="sm" icon={Sparkles}>
            {t("app.programBadge")}
          </Chip>
          <h1 id="landing-title" className="t-display-xl mt-3.5 mb-3 max-w-[250px] text-fg sm:max-w-none">
            <span className="block whitespace-nowrap">{t("app.heroTitleLine1")}</span>
            <span className="block whitespace-nowrap">
              {t("app.heroLine2Lead")}
              <span className={markClass}>{t("app.heroLine2Mark")}</span>
            </span>
            <span className="block whitespace-nowrap">{t("app.heroLine3Full")}</span>
          </h1>
          <p className="max-w-[300px] text-base leading-[1.7] text-fg-muted sm:max-w-none">
            <span className="sm:whitespace-nowrap">{t("app.heroLeadLine1")}</span>
            <br />
            <span className="sm:whitespace-nowrap">{t("app.heroLeadLine2")}</span>
            <br />
            {t("app.heroLeadLine3")}
          </p>
          {/* One Reedy, beside headline lines 2–3 and the lead; never over the LINE button. */}
          <ReedyMini
            mood="cheer"
            size="lg"
            narrowSize="smd"
            decorative
            className="absolute top-[112px] right-0.5 origin-top-right sm:top-[60px] sm:right-6 sm:scale-125"
          />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-[calc(24px+var(--safe-bottom))]">
        {/* ── Entry actions ── */}
        <div className="mt-5 grid gap-3.5 sm:max-w-[420px]">
          <EntryCta id="cta-line-login" href={ctaHref} label={ctaLabel} isLoggedIn={isLoggedIn} />
          <Link href="/courses" className={cn(buttonVariants({ variant: "outline", size: "cta" }), "w-full")}>
            {t("app.browseClasses")}
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
          {/* One centred line; under ~360px it wraps between the two authored phrases (icon stays with the first). */}
          <p className="text-center text-sm leading-[1.6] text-balance text-fg-muted">
            <span className="whitespace-nowrap">
              <ShieldCheck aria-hidden="true" className="mr-1.5 inline size-4 align-[-3px]" strokeWidth={2.4} />
              {t("app.trustLineLead")}
            </span>{" "}
            <span className="whitespace-nowrap">{t("app.trustLineTail")}</span>
          </p>
        </div>

        {/* ── Facts + the live catalogue ── */}
        <PublicCatalogPreview className="mt-[22px]" />

        {/* ── Steps ── */}
        <section aria-labelledby="landing-steps" className="mt-7">
          <SectionHeader id="landing-steps" title={t("app.howItWorksTitle")} />
          <ol className={cn(cardClass, "mt-1.5 grid sm:grid-cols-3")}>
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2.5",
                  index > 0 && "border-t-[1.5px] border-hairline sm:border-t-0 sm:border-l-[1.5px]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-[14px] font-heading text-lg leading-none font-bold",
                    step.tone,
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="t-row block text-fg">{t(step.title)}</span>
                  <span className="t-body-s block text-fg-muted">{thaiCopy(t(step.desc))}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Product and service details ── */}
        <section aria-labelledby="product-service-details" className="mt-7">
          <SectionHeader title={t("app.productDetailsTitle")} />
          <article className={cn(cardClass, "mt-1.5 p-[18px]")}>
            <h3 id="product-service-details" className="t-title-s text-balance text-fg">
              {keepThaiWords(t("app.productDetailsName"))}
            </h3>
            <p className="t-body-s mt-2 text-fg-muted">{thaiCopy(t("app.productDetailsDescription"))}</p>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-[1.7] text-fg-muted marker:text-fg-subtle">
              <li>{thaiCopy(t("app.productDetailsCourse"))}</li>
              <li>{thaiCopy(t("app.productDetailsMaterials"))}</li>
              <li>{thaiCopy(t("app.productDetailsPrice"))}</li>
              <li>{thaiCopy(t("app.productDetailsPayment"))}</li>
            </ul>
          </article>
        </section>

        {/* ── Closing call to action (the same LINE entry, for those who scrolled) ── */}
        <section aria-labelledby="landing-have-link" className={cn(cardClass, "mt-7 flex flex-col items-center p-5 text-center")}>
          <h2 id="landing-have-link" className="t-title text-balance text-fg">
            {t("app.haveTutorLink")}
          </h2>
          <p className="t-body-s mt-0.5 text-fg-muted">{t("app.continueAfterLogin")}</p>
          <div className="mt-[18px] w-full max-w-[360px]">
            <EntryCta id="cta-line-login-bottom" href={ctaHref} label={ctaLabel} isLoggedIn={isLoggedIn} tone="soft" />
          </div>
          <p className="mt-3 text-xs leading-[1.6] text-fg-muted">{thaiCopy(t("app.secureOmiseLine"))}</p>
        </section>

        {/* ── Footer ── */}
        <footer className="mt-7 flex flex-col items-center gap-2 text-center">
          <BusinessContactCard />
          <nav aria-label={t("entry.legalLinksAria")} className="flex flex-wrap items-center justify-center gap-1">
            <Link href="/terms" className={legalLinkClass}>
              {t("app.terms")}
            </Link>
            <span aria-hidden="true" className="text-fg-subtle">
              ·
            </span>
            <Link href="/privacy" className={legalLinkClass}>
              {t("app.privacyPolicy")}
            </Link>
          </nav>
          <p className="text-xs leading-[1.6] text-fg-muted">{t("entry.copyright")}</p>
        </footer>
      </div>
    </Screen>
  );
}
