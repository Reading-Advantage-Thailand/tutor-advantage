"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Chip,
  HScroll,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  StatTile,
  Surface,
} from "@/components/mobile";
import { BrandMark } from "@/components/icons/BrandMark";
import { LineIcon } from "@/components/icons/LineIcon";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ENTRY_HERO_BG } from "./BrandSplash";

/** Reading series shown on the landing page (only the first one is open). */
const COURSES = [
  { cefr: "A1", levels: "3.1", open: true },
  { cefr: "A1", levels: "1-3.2", open: false },
  { cefr: "A2", levels: "4-6", open: false },
  { cefr: "B1", levels: "7-9", open: false },
  { cefr: "B2", levels: "10-12", open: false },
  { cefr: "C1", levels: "13-15", open: false },
] as const;

const STATS = [
  {
    value: "32",
    unit: "app.statBookUnit",
    label: "app.statBooks",
    icon: BookOpen,
    tone: "brand",
  },
  {
    value: "448",
    unit: "app.statArticleUnit",
    label: "app.statArticles",
    icon: FileText,
    tone: "blue",
  },
  {
    value: "1,150+",
    unit: null,
    label: "app.statHours",
    icon: Clock,
    tone: "purple",
  },
] as const;

const STEPS = [
  {
    title: "app.stepLinkTitle",
    desc: "app.stepLinkDesc",
    tone: "bg-tile-brand text-icon-brand",
  },
  {
    title: "app.stepPayTitle",
    desc: "app.stepPayDesc",
    tone: "bg-tile-blue text-icon-blue",
  },
  {
    title: "app.stepStartTitle",
    desc: "app.stepStartDesc",
    tone: "bg-tile-purple text-icon-purple",
  },
] as const;

/** White 52px CTA on the green hero. */
const heroPrimaryCta = cn(
  buttonVariants({ size: "cta" }),
  "w-full bg-white font-bold text-brand-700 shadow-[0_6px_20px_-8px_rgb(0_0_0/0.45)] active:scale-[0.97] active:bg-white/90",
);
/** Outlined 52px CTA on the green hero. */
const heroSecondaryCta = cn(
  buttonVariants({ size: "cta" }),
  "w-full border-hero-ring bg-hero-chip font-semibold text-hero-fg active:scale-[0.97] active:bg-white/80",
);

export interface LandingMarketingProps {
  /** LINE-logged-in (rare here: logged-in users are redirected). Switches the CTAs to the dashboard. */
  isLoggedIn: boolean;
}

/**
 * Marketing page for regular browsers that are not logged in. Code-split from
 * "/" so the LIFF entry (inside LINE) only ships the splash.
 */
export function LandingMarketing({ isLoggedIn }: LandingMarketingProps) {
  const ctaHref = isLoggedIn ? "/dashboard" : "/login";
  const ctaLabel = isLoggedIn ? t("app.goDashboard") : t("app.lineLogin");

  return (
    <Screen>
      {/* ── Hero ── */}
      <section
        className={cn(
          ENTRY_HERO_BG,
          "rounded-b-[28px] px-5 pt-[calc(var(--safe-top)+20px)] pb-8 text-hero-fg",
        )}
      >
        <div className="mx-auto w-full max-w-xl">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" tone="onBrand" />
            <span className="text-base leading-[1.5] font-bold">
              {t("entry.brandName")}
            </span>
          </div>

          <Chip tone="onBrand" size="md" icon={Sparkles} className="mt-8">
            {t("app.programBadge")}
          </Chip>

          <h1 className="mt-4 text-[32px] leading-[1.3] font-extrabold tracking-tight">
            {t("app.heroTitleLine1")}
            <br />
            <span className="text-brand-300">{t("app.heroTitleLine2")}</span>
            <br />
            {t("app.heroTitleLine3")}
          </h1>

          <p className="mt-3 text-[15px] leading-[1.7] text-hero-fg-muted">
            {t("app.heroSubtitleLine1")}
            <br />
            {t("app.heroSubtitleLine2")}
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <Link href={ctaHref} id="cta-line-login" className={heroPrimaryCta}>
              <LineIcon size={22} />
              {ctaLabel}
            </Link>
            <Link href="/classes" className={heroSecondaryCta}>
              {t("app.browseClasses")}
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-7 px-4 pt-5 pb-[calc(24px+var(--safe-bottom))]">
        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {STATS.map((stat) => (
            <StatTile
              key={stat.label}
              icon={stat.icon}
              tone={stat.tone}
              value={
                <>
                  {stat.value}
                  {stat.unit ? (
                    <span className="ml-1 text-xs font-semibold text-fg-muted">
                      {t(stat.unit)}
                    </span>
                  ) : null}
                </>
              }
              label={t(stat.label)}
            />
          ))}
        </div>

        {/* ── How it works ── */}
        <section>
          <SectionHeader title={t("app.howItWorksTitle")} />
          <ListGroup>
            {STEPS.map((step, index) => (
              <ListRow
                key={step.title}
                leading={
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl text-[15px] font-extrabold tabular-nums",
                      step.tone,
                    )}
                  >
                    {index + 1}
                  </span>
                }
                title={t(step.title)}
                subtitle={t(step.desc)}
              />
            ))}
          </ListGroup>
        </section>

        {/* ── Courses ── */}
        <section>
          <SectionHeader title={t("app.availableCourses")} />
          <HScroll snap gap={12} aria-label={t("app.availableCourses")}>
            {COURSES.map((course) => (
              <div
                key={`${course.cefr}-${course.levels}`}
                className={cn(
                  "flex w-[150px] shrink-0 snap-start flex-col rounded-[var(--radius-card)] border p-4",
                  course.open
                    ? cn(ENTRY_HERO_BG, "border-transparent text-hero-fg")
                    : "border-hairline bg-surface text-fg shadow-[var(--shadow-card)]",
                )}
              >
                <span
                  className={cn(
                    "text-xs leading-[1.5] font-bold",
                    course.open ? "text-hero-fg-muted" : "text-fg-muted",
                  )}
                >
                  {course.cefr} · {t("entry.courseLevel")} {course.levels}
                </span>
                <span className="mt-1 text-lg leading-[1.4] font-extrabold">
                  {t("entry.courseReading")}
                </span>
                <Chip
                  tone={course.open ? "onBrand" : "neutral"}
                  size="sm"
                  className="mt-3 self-start"
                >
                  {course.open ? t("entry.courseOpen") : t("entry.courseSoon")}
                </Chip>
              </div>
            ))}
          </HScroll>
        </section>

        {/* ── Bottom CTA ── */}
        <Surface
          padding="lg"
          className="flex flex-col items-center text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-tile-brand text-icon-brand">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-3 text-base leading-[1.6] font-bold text-fg">
            {t("app.haveTutorLink")}
          </p>
          <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">
            {t("app.continueAfterLogin")}
          </p>
          <Link
            href={ctaHref}
            id="cta-line-login-bottom"
            className={cn(
              buttonVariants({ variant: "line", size: "cta" }),
              "mt-5 w-full max-w-[320px]",
            )}
          >
            <LineIcon variant="mono" size={24} />
            {ctaLabel}
          </Link>
          <p className="mt-3 text-xs leading-[1.6] text-fg-muted">
            {t("app.secureOmiseLine")}
          </p>
        </Surface>

        {/* ── Footer ── */}
        <footer className="flex flex-col items-center gap-1 pb-2 text-center">
          <nav
            aria-label={t("entry.legalLinksAria")}
            className="flex items-center gap-1"
          >
            <Link
              href="/terms"
              className="flex min-h-11 items-center rounded-lg px-3 text-[13px] font-semibold text-fg-muted active:bg-press"
            >
              {t("app.terms")}
            </Link>
            <span aria-hidden="true" className="text-fg-subtle">
              ·
            </span>
            <Link
              href="/privacy"
              className="flex min-h-11 items-center rounded-lg px-3 text-[13px] font-semibold text-fg-muted active:bg-press"
            >
              {t("app.privacyPolicy")}
            </Link>
          </nav>
          <p className="text-xs leading-[1.5] text-fg-muted">
            {t("entry.copyright")}
          </p>
        </footer>
      </div>
    </Screen>
  );
}
