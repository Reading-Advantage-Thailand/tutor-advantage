"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Check, Play, SearchX } from "lucide-react";
import { EmptyState } from "@/components/app/Feedback";
import { Chip } from "@/components/app/Atoms";
import { LessonContent, LessonDock } from "@/components/app/LessonShell";
import { SearchField } from "@/components/app/Fields";
import { SegmentedControl } from "@/components/app/Segmented";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { LessonCover } from "../_components/LessonCover";
import {
  fill,
  filterArticles,
  lessonStartHref,
  type LessonArticle,
  type LessonStatusFilter,
  type PreparationMode,
} from "../_lib/articles";

/**
 * Lesson picker (patterns.md T2 list + S12 selectable cards): a sticky
 * toolbar (search + status filter with counts), then the book's chapters as
 * selectable cards: a row card on phones (cover 72 + text), a cover-first
 * card from 640px. Cards are tappable (rim + 2px ledge); the selected one
 * gets a 2px --brand-fg border, a check badge and a --brand-soft tint, and
 * the native radios keep keyboard and screen-reader behaviour. The bottom
 * dock repeats the choice and holds the page's one primary action.
 */
export function SelectLessonClient({
  classId,
  articles,
  nextArticleId,
  preparationMode,
  header,
}: {
  classId: string;
  articles: LessonArticle[];
  nextArticleId: string | null;
  preparationMode: PreparationMode | null;
  /** Server-rendered PageHeader. */
  header: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LessonStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(nextArticleId);
  const [starting, setStarting] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => filterArticles(articles, deferredQuery, status), [articles, deferredQuery, status]);
  const selected = useMemo(() => articles.find((article) => article.id === selectedId) ?? null, [articles, selectedId]);
  const doneCount = useMemo(() => articles.filter((article) => article.isCompleted).length, [articles]);

  const cancelHref = preparationMode ? `/lesson/${classId}/prepare` : `/dashboard/classes/${classId}`;
  const startLabel = starting
    ? t("lesson.select.starting")
    : preparationMode
      ? t("lesson.preflow.select.startPrepare")
      : t("lesson.select.start");

  const start = (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedId || starting) return;
    setStarting(true);
    router.push(lessonStartHref(classId, selectedId, preparationMode));
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
  };

  return (
    <form onSubmit={start} className="flex flex-1 flex-col">
      <LessonContent width="wide" className="flex-1 gap-4 md:gap-5">
        {header}

        {articles.length === 0 ? (
          <EmptyState
            mascot
            icon={BookOpen}
            title={t("lesson.preflow.hub.noArticlesTitle")}
            description={t("lesson.preflow.hub.noArticlesBody")}
            action={
              <Link href={`/dashboard/classes/${classId}`} className={buttonVariants({ variant: "tonal", size: "lg" })}>
                {t("lesson.preflow.hub.openClass")}
              </Link>
            }
          />
        ) : (
          <>
            <div className="sticky top-0 z-(--z-sticky) -mx-4 flex flex-col gap-2 border-b border-hairline bg-app px-4 py-2.5 md:-mx-6 md:flex-row md:items-center md:px-6">
              <SearchField
                value={query}
                onValueChange={setQuery}
                label={t("lesson.preflow.select.searchLabel")}
                placeholder={t("lesson.preflow.select.searchPlaceholder")}
                containerClassName="md:max-w-md"
                enterKeyHint="search"
                onKeyDown={(event) => {
                  // Enter in the search box filters; it must not start the lesson.
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
              <SegmentedControl<LessonStatusFilter>
                aria-label={t("lesson.preflow.select.filterLabel")}
                value={status}
                onValueChange={setStatus}
                className="md:ml-auto"
                fullWidth="mobile"
                size="lg"
                items={[
                  { value: "all", label: t("lesson.preflow.select.filterAll"), count: articles.length },
                  { value: "todo", label: t("lesson.preflow.select.filterTodo"), count: articles.length - doneCount },
                  { value: "done", label: t("lesson.preflow.select.filterDone"), count: doneCount },
                ]}
              />
            </div>

            <p className="sr-only" aria-live="polite">
              {fill(t("lesson.preflow.select.resultCount"), { count: visible.length })}
            </p>

            {visible.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={t("lesson.preflow.select.noMatchTitle")}
                description={t("lesson.preflow.select.noMatchBody")}
                action={
                  <Button type="button" variant="outline" size="lg" onClick={clearFilters}>
                    {t("lesson.preflow.select.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <fieldset className="min-w-0">
                <legend className="sr-only">{t("lesson.preflow.select.listLabel")}</legend>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {visible.map((article) => (
                    <li key={article.id} className="min-w-0">
                      <ArticleOption
                        article={article}
                        checked={article.id === selectedId}
                        isNext={article.id === nextArticleId}
                        onSelect={() => setSelectedId(article.id)}
                        onStart={() => start()}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </>
        )}
      </LessonContent>

      <LessonDock>
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3" aria-live="polite">
            {selected ? (
              <>
                <LessonCover
                  src={selected.imageUrl}
                  alt=""
                  seed={selected.articleNumber}
                  className="hidden size-11 shrink-0 rounded-(--radius-ctl-sm) sm:block"
                  iconClassName="size-5"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-brand-fg">
                    {t("lesson.preflow.select.selectedLabel")} · {fill(t("lesson.preflow.chapter"), { n: selected.articleNumber })}
                  </p>
                  <p lang="en" className="truncate text-[0.9375rem] font-semibold text-fg">
                    {selected.title}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-fg-muted">{thaiLabel(t("lesson.preflow.select.nothingSelected"))}</p>
            )}
          </div>
          <Link href={cancelHref} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "hidden shrink-0 sm:inline-flex")}>
            {t("lesson.select.cancel")}
          </Link>
          <Button type="submit" size="xl" disabled={!selectedId || starting} loading={starting} className="shrink-0 sm:min-w-44">
            {starting ? null : <Play aria-hidden="true" />}
            {startLabel}
          </Button>
        </div>
      </LessonDock>
    </form>
  );
}

function ArticleOption({
  article,
  checked,
  isNext,
  onSelect,
  onStart,
}: {
  article: LessonArticle;
  checked: boolean;
  isNext: boolean;
  onSelect: () => void;
  onStart: () => void;
}) {
  const chapter = fill(t("lesson.preflow.chapter"), { n: article.articleNumber });
  return (
    <label
      onDoubleClick={onStart}
      className={cn(
        "group relative flex h-full cursor-pointer items-start gap-3 overflow-hidden rounded-(--radius-card) border p-3 sm:flex-col sm:items-stretch sm:gap-0 sm:p-0",
        "transition-[background-color,border-color,box-shadow,translate] duration-(--duration-press) ease-(--ease-out) [-webkit-tap-highlight-color:transparent] active:translate-y-px",
        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring has-[:focus-visible]:outline-solid",
        checked
          ? "border-brand-fg bg-brand-soft shadow-[inset_0_0_0_1px_var(--brand-fg),0_var(--ledge)_0_var(--brand-soft-border)]"
          : "border-clay-rim bg-surface shadow-tap hover:bg-row-hover active:shadow-[0_1px_0_var(--clay-ledge)]",
      )}
    >
      <input type="radio" name="articleId" value={article.id} checked={checked} onChange={onSelect} className="sr-only" />
      <LessonCover
        src={article.imageUrl}
        alt={fill(t("lesson.preflow.coverAlt"), { title: article.title })}
        seed={article.articleNumber}
        className="size-[72px] shrink-0 rounded-(--radius-ctl) sm:aspect-[16/9] sm:size-auto sm:w-full sm:rounded-none"
        iconClassName="sm:size-9"
      />
      <div className="min-w-0 flex-1 pr-8 sm:flex sm:flex-col sm:p-4 sm:pt-3 sm:pr-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.8125rem] font-medium text-fg-muted tabular">{chapter}</span>
          {isNext ? (
            <Chip tone="brand" size="sm" dot>
              {t("lesson.preflow.next")}
            </Chip>
          ) : null}
          {article.isCompleted ? (
            <Chip tone="success" size="sm" icon={Check}>
              {t("lesson.preflow.completed")}
            </Chip>
          ) : null}
          {article.cefrLevel ? <Chip size="sm">{fill(t("lesson.preflow.cefr"), { level: article.cefrLevel })}</Chip> : null}
        </div>
        <h3 lang="en" className="mt-1 line-clamp-2 type-card text-fg">
          {article.title}
        </h3>
        {article.summary ? <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-[1.6] text-fg-muted">{article.summary}</p> : null}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-3 right-3 flex size-7 items-center justify-center rounded-full transition-colors duration-(--duration-fast)",
          checked
            ? "bg-brand-solid text-on-brand shadow-[0_0_0_2px_var(--surface-card)]"
            : "border-2 border-field-border bg-surface sm:shadow-card",
        )}
      >
        {checked ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}
