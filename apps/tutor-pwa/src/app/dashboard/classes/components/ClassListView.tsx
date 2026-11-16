"use client";

import { useId, useMemo, useState } from "react";
import { BookOpen, SearchX } from "lucide-react";
import {
  DataTable,
  EmptyState,
  IconTile,
  SearchField,
  SegmentedControl,
  Toolbar,
  type DataTableColumn,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { keepThaiWords } from "@/lib/thaiText";
import {
  ClassRow,
  ClassSetupLink,
  ClassStatusChip,
  SetupPendingChip,
  classTileTone,
  seatsLabel,
  type ClassListItem,
} from "./ClassRow";
import { DeleteClassButton } from "./DeleteClassButton";

type StatusFilter = "all" | "active" | "closed";

const isClosed = (cls: ClassListItem) => cls.status === "closed";

function matchesQuery(cls: ClassListItem, query: string) {
  if (!query) return true;
  return `${cls.name} ${cls.book ?? ""}`.toLocaleLowerCase("th").includes(query);
}

/**
 * Column widths. The tables lay out fixed (DataTable layout="fixed"), so the
 * open and closed tables line up whatever their rows hold: every column but
 * the class has a set width and the class takes the rest. The schedule gives
 * up some width below xl (the 1024 rail layout) so class names keep room.
 */
const COLUMN_WIDTH = { schedule: "var(--class-schedule-w)", students: "112px", status: "148px" } as const;
const scheduleWidthClass = "[--class-schedule-w:20%] xl:[--class-schedule-w:24%]";

/** The actions column fits the setup link; the DEV delete button wraps under it when both show. */
function actionsWidth(hasSetup: boolean) {
  return hasSetup ? "172px" : "128px";
}

function classColumns(hasSetup: boolean, showDevDelete: boolean): DataTableColumn<ClassListItem>[] {
  const columns: DataTableColumn<ClassListItem>[] = [
    {
      key: "class",
      header: t("tutorClass.classPages.columnClass"),
      mobile: "primary",
      cell: (cls) => (
        <span className="flex min-w-0 items-center gap-3">
          <IconTile icon={BookOpen} tone={classTileTone(cls)} size="sm" />
          <span className="min-w-0">
            <span className="block font-semibold text-balance-th break-words text-fg">{cls.name}</span>
            {cls.book ? <span className="block truncate text-[0.8125rem] font-normal text-fg-muted">{cls.book}</span> : null}
          </span>
        </span>
      ),
    },
    {
      key: "schedule",
      header: t("tutorClass.classes.scheduleLabel"),
      width: COLUMN_WIDTH.schedule,
      cell: (cls) =>
        cls.nextSession ? (
          // Wraps, never cut (as in ClassRow): the lesson time is the end of the string.
          <span className="block break-words text-fg-muted">{keepThaiWords(cls.nextSession)}</span>
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
    },
    {
      key: "students",
      header: t("tutorClass.classes.studentsTitle"),
      align: "right",
      width: COLUMN_WIDTH.students,
      cell: (cls) => <span className="whitespace-nowrap">{seatsLabel(cls)}</span>,
    },
    {
      key: "status",
      header: t("tutorClass.classPages.columnStatus"),
      width: COLUMN_WIDTH.status,
      cell: (cls) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <ClassStatusChip status={cls.status} />
          {cls.setupRequired ? <SetupPendingChip /> : null}
        </span>
      ),
    },
  ];
  if (hasSetup || showDevDelete) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">{t("tutorClass.classPages.columnActions")}</span>,
      align: "right",
      width: actionsWidth(hasSetup),
      // Desktop only: phones and tablets use ClassRow (the table renders no cards).
      mobile: "hidden",
      cell: (cls) =>
        cls.setupRequired || showDevDelete ? (
          // Above the row's stretched link so these stay clickable.
          <span className="pointer-events-none relative z-10 flex flex-wrap items-center justify-end gap-2 [&>*]:pointer-events-auto">
            {cls.setupRequired ? <ClassSetupLink classId={cls.id} /> : null}
            {showDevDelete ? <DeleteClassButton classId={cls.id} className={cls.name} /> : null}
          </span>
        ) : null,
    });
  }
  return columns;
}

/** Group heading + count ("คลาสที่เปิดอยู่ · 7 คลาส"). */
function GroupHeader({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <div className="flex min-h-11 items-baseline gap-2">
      <h2 id={id} className="type-section text-fg">
        {title}
      </h2>
      <span className="type-body-s text-fg-muted tabular">
        {count} {t("tutorClass.ui.classesUnit")}
      </span>
    </div>
  );
}

function ClassGroup({
  title,
  classes,
  columns,
  showDevDelete,
}: {
  title: string;
  classes: ClassListItem[];
  columns: DataTableColumn<ClassListItem>[];
  showDevDelete: boolean;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2">
      <GroupHeader id={headingId} title={title} count={classes.length} />
      {/* Phones and tablets: flat rows in one card. */}
      <ul aria-labelledby={headingId} className="ds-card overflow-hidden lg:hidden">
        {classes.map((cls) => (
          <ClassRow key={cls.id} cls={cls} showDevDelete={showDevDelete} />
        ))}
      </ul>
      {/* Desktop (side nav): the table, rows open the class. Below lg the rows above stand in for its cards. */}
      <DataTable
        caption={title}
        breakpoint="lg"
        cards="none"
        // Fixed layout: the set column widths hold, so stacked tables line up.
        layout="fixed"
        className={scheduleWidthClass}
        rows={classes}
        getRowKey={(cls) => cls.id}
        rowHref={(cls) => `/dashboard/classes/${cls.id}`}
        columns={columns}
      />
    </section>
  );
}

/**
 * Classes list body (patterns.md T2): toolbar (search + status filter with
 * counts), then the open and closed groups. Filtering is in place over the
 * classes the page already loaded.
 */
export function ClassListView({ classes, showDevDelete = false }: { classes: ClassListItem[]; showDevDelete?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const searchId = useId();

  // One column set for both groups, so the open and closed tables line up.
  const hasSetup = classes.some((cls) => cls.setupRequired);
  const columns = useMemo(() => classColumns(hasSetup, showDevDelete), [hasSetup, showDevDelete]);

  const normalized = query.trim().toLocaleLowerCase("th");
  const matching = classes.filter((cls) => matchesQuery(cls, normalized));
  const active = matching.filter((cls) => !isClosed(cls));
  const closed = matching.filter(isClosed);

  const groups = [
    { key: "active", title: t("tutorClass.ui.activeClasses"), rows: active, show: filter !== "closed" },
    { key: "closed", title: t("tutorClass.ui.closedClasses"), rows: closed, show: filter !== "active" },
  ].filter((group) => group.show && group.rows.length > 0);
  const shownCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const emptyTitle = normalized ? t("tutorClass.classPages.noMatchTitle") : t("tutorClass.classPages.noneInFilter");

  /** Clears the search from the no-match card; focus goes to the search box before the card unmounts. */
  const clearSearch = () => {
    document.getElementById(searchId)?.focus();
    setQuery("");
  };

  return (
    <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
      {/* Announces what search/filter changes leave on screen (WCAG 4.1.3). */}
      <p role="status" className="sr-only">
        {shownCount > 0
          ? `${t("tutorClass.classPages.resultsPrefix")} ${shownCount} ${t("tutorClass.ui.classesUnit")}`
          : emptyTitle}
      </p>
      <Toolbar className="md:gap-3">
        <SearchField
          id={searchId}
          value={query}
          onValueChange={setQuery}
          label={t("tutorClass.classPages.searchLabel")}
          placeholder={t("tutorClass.classPages.searchPlaceholder")}
          containerClassName="basis-full md:basis-auto md:max-w-sm"
        />
        <SegmentedControl<StatusFilter>
          aria-label={t("tutorClass.classPages.filterLabel")}
          value={filter}
          onValueChange={setFilter}
          // Full width on phones (equal segments), natural width beside the search on wider screens,
          // where it matches the search field's 44px height.
          fullWidth="mobile"
          size="lg"
          items={[
            { value: "all", label: t("tutorClass.classPages.filterAll"), count: matching.length },
            { value: "active", label: t("tutorClass.classPages.filterActive"), count: active.length },
            { value: "closed", label: t("tutorClass.classPages.filterClosed"), count: closed.length },
          ]}
        />
      </Toolbar>

      {groups.length > 0 ? (
        groups.map((group) => (
          <ClassGroup key={group.key} title={group.title} classes={group.rows} columns={columns} showDevDelete={showDevDelete} />
        ))
      ) : (
        <EmptyState
          icon={SearchX}
          title={emptyTitle}
          description={normalized ? t("tutorClass.classPages.noMatchBody") : undefined}
          action={
            normalized ? (
              <Button variant="tonal" onClick={clearSearch}>
                {t("shell.clearSearch")}
              </Button>
            ) : null
          }
        />
      )}
    </div>
  );
}
