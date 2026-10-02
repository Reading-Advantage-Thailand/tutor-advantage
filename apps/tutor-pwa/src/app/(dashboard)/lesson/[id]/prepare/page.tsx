import { ArrowRight, Check, Compass, MousePointer2, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Chip, IconTile, type TileTone } from "@/components/app/Atoms";
import { Notice } from "@/components/app/Feedback";
import { LessonContent } from "@/components/app/LessonShell";
import { Grid, PageHeader, Section } from "@/components/app/Page";
import { Surface } from "@/components/app/Surface";
import { t } from "@/lib/i18n";
import type { PreparationMode } from "../_lib/articles";

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
            <Chip tone={articleId ? "brand" : "neutral"} icon={articleId ? Check : undefined}>
              {articleId ? t("lesson.preflow.prepare.articleChosen") : t("lesson.preflow.prepare.articleNext")}
            </Chip>
          </>
        }
      />

      <Section title={t("lesson.preflow.prepare.modesTitle")} description={t("lesson.preflow.prepare.modesDescription")}>
        <Grid cols={2}>
          {modes.map((card) => (
            <Surface key={card.mode} href={modeHref(card.mode)} padding="lg" className="group flex h-full flex-col">
              <span className="flex items-start justify-between gap-3">
                <IconTile icon={card.icon} tone={card.tone} size="lg" />
                <Chip tone={card.tagTone} icon={card.mode === "guided" ? Sparkles : undefined}>
                  {card.tag}
                </Chip>
              </span>
              <span className="mt-4 block text-lg font-semibold text-fg">{card.title}</span>
              <span className="mt-1 block text-sm text-fg-muted">{card.description}</span>
              <ul className="mt-4 flex flex-col gap-2">
                {card.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-fg">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-fg" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand-fg">
                {card.cta}
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Surface>
          ))}
        </Grid>
      </Section>

      <Notice tone="neutral" icon={ShieldCheck} title={t("lesson.preflow.prepare.safeTitle")}>
        {t("lesson.preflow.prepare.safeBody")}
      </Notice>
    </LessonContent>
  );
}
