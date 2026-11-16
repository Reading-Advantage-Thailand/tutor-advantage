import { ArrowRight, Check, Compass, MousePointer2, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Chip, IconTile, type TileTone } from "@/components/app/Atoms";
import { Notice } from "@/components/app/Feedback";
import { LessonContent } from "@/components/app/LessonShell";
import { Grid, PageHeader, Section } from "@/components/app/Page";
import { Surface } from "@/components/app/Surface";
import { buttonVariants } from "@/components/ui/button-variants";
import { t } from "@/lib/i18n";
import { thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import type { PreparationMode } from "../_lib/articles";

/**
 * The card's call to action, drawn as the shared button (xl, 48: buttonVariants
 * from the server-safe ui/button-variants) but plain text in the card link: a
 * real button inside a link is not allowed.
 */
const ctaClass = (recommended: boolean) =>
  cn(buttonVariants({ variant: recommended ? "default" : "outline", size: "xl" }), "w-full");

interface ModeCard {
  mode: PreparationMode;
  icon: LucideIcon;
  tone: TileTone;
  title: string;
  tag: string;
  tagTone: "brand" | "neutral";
  description: string;
  points: string[];
  cta: string;
}

/**
 * Rehearsal mode picker: two tappable mode cards (rim + ledge, one accessible
 * name each). The guided card is the recommended path, so its call to action
 * is drawn as the page's one primary button; the explore card's as a
 * secondary one. They are text inside the card link, not nested buttons.
 */
export default async function PrepareLessonModePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ articleId?: string }>;
}) {
  const [{ id: classId }, { articleId }] = await Promise.all([params, searchParams]);

  const modeHref = (mode: PreparationMode) =>
    articleId
      ? `/lesson/${classId}/prepare/lesson?articleId=${encodeURIComponent(articleId)}&mode=${mode}`
      : `/lesson/${classId}/select?prepare=1&mode=${mode}`;

  const modes: ModeCard[] = [
    {
      mode: "guided",
      icon: MousePointer2,
      tone: "purple",
      title: t("lesson.preflow.prepare.guidedTitle"),
      tag: t("lesson.preflow.prepare.guidedTag"),
      tagTone: "brand",
      description: t("lesson.preflow.prepare.guidedDescription"),
      points: [
        t("lesson.preflow.prepare.guidedPoint1"),
        t("lesson.preflow.prepare.guidedPoint2"),
        t("lesson.preflow.prepare.guidedPoint3"),
      ],
      cta: t("lesson.preflow.prepare.guidedCta"),
    },
    {
      mode: "explore",
      icon: Compass,
      tone: "blue",
      title: t("lesson.preflow.prepare.exploreTitle"),
      tag: t("lesson.preflow.prepare.exploreTag"),
      tagTone: "neutral",
      description: t("lesson.preflow.prepare.exploreDescription"),
      points: [
        t("lesson.preflow.prepare.explorePoint1"),
        t("lesson.preflow.prepare.explorePoint2"),
        t("lesson.preflow.prepare.explorePoint3"),
      ],
      cta: t("lesson.preflow.prepare.exploreCta"),
    },
  ];

  return (
    <LessonContent width="default">
      <PageHeader
        title={t("lesson.preflow.prepare.title")}
        description={t("lesson.preflow.prepare.description")}
        meta={
          <>
            <Chip tone="success" icon={ShieldCheck}>
              {t("lesson.preflow.prepare.privateSpace")}
            </Chip>
            <Chip tone={articleId ? "brand" : "neutral"} icon={articleId ? Check : undefined} dot={!articleId}>
              {articleId ? t("lesson.preflow.prepare.articleChosen") : t("lesson.preflow.prepare.articleNext")}
            </Chip>
          </>
        }
      />

      <Section
        title={t("lesson.preflow.prepare.modesTitle")}
        description={t("lesson.preflow.prepare.modesDescription")}
      >
        <Grid cols={2} className="md:gap-5">
          {modes.map((card) => {
            const recommended = card.mode === "guided";
            return (
              <Surface key={card.mode} href={modeHref(card.mode)} padding="lg" className="group flex h-full flex-col">
                <span className="flex items-start justify-between gap-3">
                  <IconTile icon={card.icon} tone={card.tone} size="xl" />
                  <Chip tone={card.tagTone} icon={recommended ? Sparkles : undefined}>
                    {card.tag}
                  </Chip>
                </span>
                <span className="mt-4 block type-section text-fg">{card.title}</span>
                {/* The card is one link: thaiLabel adds spans only, so its accessible name is unchanged. */}
                <span className="mt-1 block text-sm leading-[1.6] text-fg-muted">{thaiLabel(card.description)}</span>
                <ul className="mt-4 flex flex-col gap-2.5 rounded-(--radius-ctl) bg-surface-muted px-3.5 py-3">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm leading-[1.6] text-fg">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg"
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span className="min-w-0">{thaiLabel(point)}</span>
                    </li>
                  ))}
                </ul>
                <span className="mt-auto pt-5">
                  <span className={ctaClass(recommended)}>
                    {card.cta}
                    <ArrowRight aria-hidden="true" className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Surface>
            );
          })}
        </Grid>
      </Section>

      <Notice tone="neutral" icon={ShieldCheck} title={t("lesson.preflow.prepare.safeTitle")}>
        {t("lesson.preflow.prepare.safeBody")}
      </Notice>
    </LessonContent>
  );
}
