"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, BookPlus, CheckCircle2, ChevronRight, Clock3, GraduationCap, Rocket, Search } from "lucide-react";
import {
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  SearchField,
  Skeleton,
  fieldControlClass,
  toast,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createClassBookCycle, getClassArticles } from "../../actions";
import { isPrimaryBook, type BookOption } from "../../components/book-options";
import { OpenBookSheet } from "./OpenBookSheet";
import { initialCycleId, type BookCycle } from "./book-cycles";

const AssessmentReport = dynamic(() => import("../../AssessmentReport"), {
  ssr: false,
  loading: () => <CardSkeleton lines={4} />,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Article = any;

/** How many lessons show before "ดูทั้งหมด" (the selected one is always shown). */
const COLLAPSED_COUNT = 6;

const articleImageUrl = (article: Article): string | null =>
  (Array.isArray(article.imageUrls) ? article.imageUrls[0] : null) || article.imageUrl || null;

const cycleLabel = (cycle: { sequence: number; title: string }) => {
  const title = cycle.title.startsWith("Primary ") ? cycle.title.replace(/\s*\([A-C]\d\)$/i, "") : cycle.title;
  return `${t("tutorClass.lessons.bookPrefix")} ${cycle.sequence}: ${title}`;
};

/** Lesson cover; removes itself when the image fails (also when it failed before hydration). */
function ArticleThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (failed) return null;
  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-muted md:size-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ref} src={src} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

/**
 * Step 1 of teaching: pick today's lesson, then prepare or open the live
 * room. The first cycle's lessons come from the server (no client
 * waterfall); switching books loads that book's lessons.
 */
export function ArticleSelector({
  classId,
  bookCycles = [],
  initialArticles,
  books = [],
}: {
  classId: string;
  bookCycles?: BookCycle[];
  /** Lessons of `initialCycleId(bookCycles)`, fetched by the page. */
  initialArticles?: Article[] | null;
  books?: BookOption[];
}) {
  const router = useRouter();
  const firstCycleId = initialCycleId(bookCycles);
  const [selectedCycleId, setSelectedCycleId] = useState(firstCycleId);
  const [articles, setArticles] = useState<Article[]>(initialArticles ?? []);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(initialArticles?.[0]?.id ?? null);
  const [fetching, setFetching] = useState(!initialArticles);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newBookId, setNewBookId] = useState("");
  const [newBookPrice, setNewBookPrice] = useState(250000);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [openBookDialogOpen, setOpenBookDialogOpen] = useState(false);
  const [articleSearch, setArticleSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const skipFetchFor = useRef<string | null>(initialArticles ? firstCycleId : null);

  const isPrimaryCycle = Boolean(
    bookCycles.find((cycle) => cycle.id === selectedCycleId)?.title.startsWith("Primary "),
  );

  const filteredArticles = useMemo(() => {
    const query = articleSearch.trim().toLocaleLowerCase("th");
    if (!query) return articles;
    return articles.filter((article) =>
      [article.title, article.summary, article.type]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("th").includes(query)),
    );
  }, [articleSearch, articles]);
  const selectedArticleData = articles.find((article) => article.id === selectedArticle);
  const searching = articleSearch.trim().length > 0;
  const visibleArticles = useMemo(() => {
    if (searching || showAll || filteredArticles.length <= COLLAPSED_COUNT + 1) return filteredArticles;
    const head = filteredArticles.slice(0, COLLAPSED_COUNT);
    const selected = filteredArticles.find((article) => article.id === selectedArticle);
    return selected && !head.includes(selected) ? [...head, selected] : head;
  }, [filteredArticles, searching, showAll, selectedArticle]);
  const hiddenCount = filteredArticles.length - visibleArticles.length;

  useEffect(() => {
    if (skipFetchFor.current === selectedCycleId) {
      skipFetchFor.current = null;
      return;
    }
    let active = true;
    async function loadArticles() {
      try {
        setFetching(true);
        setError(null);
        const data = await getClassArticles(classId, selectedCycleId || undefined);
        if (!active) return;
        setArticles(data.articles || []);
        if (data.articles && data.articles.length > 0) {
          setSelectedArticle(data.articles[0].id);
        }
      } catch (err) {
        console.error(err);
        if (active) setError(t("tutorClass.detail.articleLoadFailed"));
      } finally {
        if (active) setFetching(false);
      }
    }
    void loadArticles();
    return () => {
      active = false;
    };
  }, [classId, selectedCycleId, reloadKey]);

  const getBookLabel = (book?: BookOption) =>
    book ? book.title || book.bookCode || t("tutorClass.lessons.untitledBook") : t("tutorClass.lessons.selectedBook");

  const validateNewBookSelection = (): { tone: "warning" | "error"; title: string; message: string } | null => {
    const selectedBook = books.find((book) => book.bookId === newBookId);
    if (!selectedBook) {
      return { tone: "error", title: t("tutorClass.lessons.bookNotFoundTitle"), message: t("tutorClass.lessons.bookNotFoundBody") };
    }
    if (bookCycles.some((cycle) => cycle.bookId === newBookId)) {
      return {
        tone: "warning",
        title: t("tutorClass.lessons.bookAlreadyOpenTitle"),
        message: `${getBookLabel(selectedBook)} ${t("tutorClass.lessons.bookAlreadyOpenBody")}`,
      };
    }
    // Primary Advantage and Reading Advantage are separate programmes: opening
    // a Primary book must not prevent the tutor from starting Reading at book 1.
    const selectedProgramIsPrimary = isPrimaryBook(selectedBook);
    const programBooks = books.filter((book) => isPrimaryBook(book) === selectedProgramIsPrimary);
    const selectedProgramBookIndex = programBooks.findIndex((book) => book.bookId === newBookId);
    const openedBookIndexes = bookCycles
      .filter((cycle) => cycle.title.startsWith("Primary ") === selectedProgramIsPrimary)
      .map((cycle) => programBooks.findIndex((book) => book.bookId === cycle.bookId))
      .filter((index) => index >= 0);
    const highestOpenedBookIndex = openedBookIndexes.length > 0 ? Math.max(...openedBookIndexes) : -1;

    if (selectedProgramBookIndex < highestOpenedBookIndex) {
      return {
        tone: "warning",
        title: t("tutorClass.lessons.bookBelowTitle"),
        message: `${t("tutorClass.lessons.bookBelowBodyPrefix")} ${getBookLabel(selectedBook)}`,
      };
    }
    if (selectedProgramBookIndex > highestOpenedBookIndex + 1) {
      const nextBook = programBooks[highestOpenedBookIndex + 1];
      return {
        tone: "warning",
        title: t("tutorClass.lessons.cannotSkipTitle"),
        message: `${t("tutorClass.lessons.cannotSkipBodyPrefix")} ${getBookLabel(nextBook)} ${t("tutorClass.lessons.cannotSkipBodyMiddle")} ${getBookLabel(selectedBook)}`,
      };
    }
    return null;
  };

  const handleStartLesson = () => {
    if (!selectedArticle) return;
    setLoading(true);
    const selectedCycle = bookCycles.find((cycle) => cycle.id === selectedCycleId);
    const params = new URLSearchParams({ articleId: selectedArticle });
    if (selectedCycleId) params.set("cycleId", selectedCycleId);
    if (selectedCycle?.bookId) params.set("bookId", selectedCycle.bookId);
    router.push(`/lesson/${classId}/interactive?${params.toString()}`);
  };

  const handlePrepareLesson = () => {
    if (!selectedArticle) return;
    router.push(`/lesson/${classId}/prepare?articleId=${encodeURIComponent(selectedArticle)}`);
  };

  const handleCreateCycle = async () => {
    if (!newBookId) return;
    const problem = validateNewBookSelection();
    if (problem) {
      const show = problem.tone === "error" ? toast.error : toast.warning;
      show(problem.title, { description: problem.message, duration: 4500 });
      return;
    }
    setCreatingCycle(true);
    try {
      const result = await createClassBookCycle(classId, { bookId: newBookId, packagePriceSatang: newBookPrice });
      setSelectedCycleId(result.cycle.id);
      setOpenBookDialogOpen(false);
      toast.success(t("tutorClass.lessons.bookOpenedTitle"), {
        description: `${result.cycle.title || t("tutorClass.lessons.selectedBook")} ${t("tutorClass.lessons.bookOpenedBody")}`,
        duration: 4500,
      });
      router.refresh();
    } catch (err) {
      toast.error(t("tutorClass.lessons.openBookFailed"), {
        description: err instanceof Error && err.message ? err.message : undefined,
        duration: 4500,
      });
    } finally {
      setCreatingCycle(false);
    }
  };

  const actionsDisabled = !selectedArticle || loading || fetching;

  return (
    <>
      <section aria-labelledby="lesson-picker-title" className="rounded-xl border border-hairline bg-surface shadow-card">
        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="lesson-picker-title" className="text-base font-semibold text-fg">
                {t("tutorClass.lessons.title")}
              </h2>
              <p className="mt-0.5 text-sm text-fg-muted">{t("tutorClass.lessons.description")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenBookDialogOpen(true)}>
              <BookPlus aria-hidden="true" />
              {t("tutorClass.lessons.openBook")}
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <label className="relative block">
              <span className="sr-only">{t("tutorClass.lessons.selectBook")}</span>
              <BookOpen aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-fg" />
              <select
                value={selectedCycleId}
                onChange={(event) => {
                  setSelectedCycleId(event.target.value);
                  setArticleSearch("");
                  setShowAll(false);
                }}
                className={cn(fieldControlClass, "h-10 cursor-pointer appearance-none pr-3 pl-9 font-medium pointer-coarse:h-11")}
              >
                {bookCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycleLabel(cycle)}
                  </option>
                ))}
              </select>
            </label>
            <SearchField
              value={articleSearch}
              onValueChange={setArticleSearch}
              label={t("tutorClass.lessons.searchLabel")}
              placeholder={t("tutorClass.lessons.searchPlaceholder")}
            />
          </div>
        </div>

        <div className="border-t border-hairline p-3 md:p-4">
          {fetching ? (
            <div className="grid gap-2 md:grid-cols-2" aria-busy="true">
              <span className="sr-only">{t("tutorClass.detail.articleLoading")}</span>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-[84px] rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              compact
              description={error}
              onRetry={() => {
                skipFetchFor.current = null;
                setReloadKey((key) => key + 1);
              }}
            />
          ) : articles.length === 0 ? (
            <EmptyState compact icon={BookOpen} title={t("tutorClass.detail.articleEmpty")} />
          ) : filteredArticles.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title={t("tutorClass.lessons.noSearchResults")}
              action={
                <Button variant="link" size="sm" onClick={() => setArticleSearch("")}>
                  {t("shell.clearSearch")}
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid gap-2 md:grid-cols-2" aria-label={t("tutorClass.lessons.listLabel")}>
                {visibleArticles.map((article) => {
                  const articleIndex = articles.findIndex((item) => item.id === article.id);
                  const isSelected = selectedArticle === article.id;
                  const image = articleImageUrl(article);
                  const typeLabel =
                    article.type ||
                    (articleIndex % 2 === 0 ? t("tutorClass.lessons.typeStory") : t("tutorClass.lessons.typeBiography"));
                  return (
                    <li key={article.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedArticle(article.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "pressable flex h-full w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                          isSelected
                            ? "border-brand-vivid bg-brand-soft"
                            : "border-hairline bg-surface hover:border-hairline-strong hover:bg-surface-muted",
                        )}
                      >
                        {image ? <ArticleThumb src={image} /> : null}
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
                            <span className="font-medium">
                              {t("tutorClass.detail.chapterPrefix")} {articleIndex + 1}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock3 aria-hidden="true" className="size-3" />
                              {article.recommendedTime || t("tutorClass.lessons.defaultDuration")}
                            </span>
                            {article.isCompleted ? (
                              <Chip tone="success" size="sm" icon={CheckCircle2}>
                                {t("tutorClass.detail.taught")}
                              </Chip>
                            ) : null}
                          </span>
                          <span className={cn("line-clamp-2 text-sm font-semibold", isSelected ? "text-brand-fg" : "text-fg")}>
                            {article.title}
                          </span>
                          <span className="truncate text-xs text-fg-muted">
                            {typeLabel}
                            {!isPrimaryCycle && article.showCefr !== false && article.cefrLevel ? ` · CEFR ${article.cefrLevel}` : ""}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            isSelected ? "border-brand-solid bg-brand-solid text-on-brand" : "border-hairline-strong",
                          )}
                        >
                          {isSelected ? <CheckCircle2 className="size-3.5" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {hiddenCount > 0 || (showAll && !searching && filteredArticles.length > COLLAPSED_COUNT + 1) ? (
                <div className="mt-3 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
                    {showAll
                      ? t("tutorClass.lessons.showLess")
                      : `${t("shell.viewAll")} (${filteredArticles.length} ${t("tutorClass.lessons.lessonsUnit")})`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Selected lesson + actions; sticks above the tab bar on phones. */}
        <div className="sticky bottom-(--tabbar-space) z-(--z-sticky) flex flex-col gap-2 rounded-b-xl border-t border-hairline bg-surface p-3 md:static md:gap-3 md:p-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg-muted max-md:sr-only">{t("tutorClass.lessons.selectedLabel")}</p>
            <p className={cn("truncate text-sm font-semibold", selectedArticleData ? "text-fg" : "text-fg-muted")}>
              {selectedArticleData?.title || t("tutorClass.lessons.selectPrompt")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
            <Button variant="outline" size="lg" disabled={actionsDisabled} onClick={handlePrepareLesson}>
              <GraduationCap aria-hidden="true" />
              {t("tutorClass.lessons.prepare")}
            </Button>
            <Button size="lg" loading={loading} disabled={actionsDisabled} onClick={handleStartLesson}>
              {loading ? null : <Rocket aria-hidden="true" />}
              {loading ? t("tutorClass.lessons.creatingRoom") : t("tutorClass.lessons.createRoom")}
              {loading ? null : <ChevronRight aria-hidden="true" className="hidden sm:block" />}
            </Button>
          </div>
        </div>
      </section>

      <OpenBookSheet
        open={openBookDialogOpen}
        onOpenChange={setOpenBookDialogOpen}
        books={books}
        bookId={newBookId}
        onBookIdChange={setNewBookId}
        priceSatang={newBookPrice}
        onPriceChange={setNewBookPrice}
        creating={creatingCycle}
        onSubmit={handleCreateCycle}
      />

      {selectedCycleId ? <AssessmentReport key={selectedCycleId} cycleId={selectedCycleId} /> : null}
    </>
  );
}
