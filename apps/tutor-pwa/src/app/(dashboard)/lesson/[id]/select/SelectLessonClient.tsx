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
            icon={BookOpen}
            title={t("lesson.preflow.hub.noArticlesTitle")}
            description={t("lesson.preflow.hub.noArticlesBody")}
            action={
              <Link href={`/dashboard/classes/${classId}`} className={buttonVariants({ variant: "outline" })}>
                {t("lesson.preflow.hub.openClass")}
              </Link>
            }
          />
        ) : (
          <>
            <div className="sticky top-0 z-(--z-sticky) -mx-4 flex flex-col gap-2 bg-app px-4 py-2 md:-mx-6 md:flex-row md:items-center md:px-6">
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
                className="md:ml-auto md:w-auto md:shrink-0 md:[&>button]:flex-none"
                fullWidth
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
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    {t("lesson.preflow.select.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <fieldset className="min-w-0">
                <legend className="sr-only">{t("lesson.preflow.select.listLabel")}</legend>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  className="hidden size-10 shrink-0 rounded-lg sm:block"
                  iconClassName="size-4"
                />
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted">
                    {t("lesson.preflow.select.selectedLabel")} · {fill(t("lesson.preflow.chapter"), { n: selected.articleNumber })}
                  </p>
                  <p className="truncate text-sm font-semibold text-fg">{selected.title}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-fg-muted">{t("lesson.preflow.select.nothingSelected")}</p>
            )}
          </div>
          <Link href={cancelHref} className={cn(buttonVariants({ variant: "ghost" }), "hidden shrink-0 sm:inline-flex")}>
            {t("lesson.select.cancel")}
          </Link>
          <Button type="submit" size="lg" disabled={!selectedId || starting} loading={starting} className="shrink-0">
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
        "pressable flex h-full cursor-pointer items-start gap-3 rounded-xl border bg-surface p-3 shadow-card transition-colors",
        "hover:border-hairline-strong has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
        checked ? "border-brand-solid bg-brand-soft/40 ring-1 ring-brand-solid" : "border-hairline",
      )}
    >
      <input
        type="radio"
        name="articleId"
        value={article.id}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <LessonCover
        src={article.imageUrl}
        alt={fill(t("lesson.preflow.coverAlt"), { title: article.title })}
        seed={article.articleNumber}
        className="size-16 shrink-0 rounded-lg md:size-[72px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-fg-muted tabular">{chapter}</span>
          {isNext ? <Chip tone="brand">{t("lesson.preflow.next")}</Chip> : null}
          {article.isCompleted ? (
            <Chip tone="success" icon={Check}>
              {t("lesson.preflow.completed")}
            </Chip>
          ) : null}
          {article.cefrLevel ? <Chip>{fill(t("lesson.preflow.cefr"), { level: article.cefrLevel })}</Chip> : null}
        </div>
        <h3 className="mt-1 line-clamp-2 text-[0.9375rem] font-semibold text-fg">{article.title}</h3>
        {article.summary ? (
          <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-fg-muted">{article.summary}</p>
        ) : null}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          checked ? "border-brand-solid bg-brand-solid text-on-brand" : "border-hairline-strong",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}
