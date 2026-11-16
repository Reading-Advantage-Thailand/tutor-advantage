"use client";

import Link from "next/link";
import { ClipboardCheck, Plus, School, TicketPercent } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  AdminStatusChip,
  Chip,
  DataTable,
  EmptyState,
  ColumnToggle,
  ErrorState,
  FilterBar,
  IconTile,
  IdentityCell,
  Money,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  useAdminSession,
  useColumnVisibility,
  type DataTableColumn,
  type TileTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { adminClassesKey } from "../discount-codes/useClassLookup";
import { classAttendanceHref } from "./attendanceModel";
import { discountCodeCreateHref, type AdminClass, type AdminClassPage } from "./classForm";
import { CreateClassSheet } from "./components/CreateClassSheet";
import { focusSearchIn } from "./components/focusRescue";
import { RowAction, RowActions } from "./components/RowAction";
import "@/locales/th/classes";

type SetupFilter = "" | "pending";

/** Class tiles take the tone of the book's CEFR band (components.md §5); books without one stay jade. */
const CEFR_TILE: Record<string, TileTone> = { A0: "teal", A1: "purple", A2: "blue", B1: "orange", B2: "pink" };

function classTileTone(bookTitle: string | null): TileTone {
  const band = /\(([A-C]\d)\)\s*$/i.exec(bookTitle ?? "")?.[1]?.toUpperCase();
  return (band ? CEFR_TILE[band] : undefined) ?? "brand";
}

function TutorCell({ tutor }: { tutor: AdminClass["tutor"] }) {
  if (!tutor) return <span className="text-fg-muted">{t("classes.noTutor")}</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-center gap-1.5">
        {/* Touch: the ::after grows the hit area to 44px tall without moving the text. */}
        <Link
          href={`/users/${encodeURIComponent(tutor.userId)}`}
          title={tutor.displayName ?? undefined}
          className="relative block max-w-48 min-w-0 font-medium text-fg hover:underline pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3"
        >
          <span className="block truncate">{tutor.displayName || t("classes.tutorUnnamed")}</span>
        </Link>
        {tutor.pendingRegistration ? (
          <Chip tone="warning" size="sm" title={t("classes.pendingRegistrationHint")}>
            {t("classes.pendingRegistrationChip")}
          </Chip>
        ) : null}
      </span>
      {tutor.email ? (
        <span className="block max-w-56 truncate text-[0.8125rem] text-fg-muted" title={tutor.email}>
          {tutor.email}
        </span>
      ) : null}
    </span>
  );
}

export default function ClassesPage() {
  const me = useAdminSession();
  const table = useTableState({ filterKeys: ["setup"] });
  const setup: SetupFilter = table.filters.setup === "pending" ? "pending" : "";
  const resourceKey = me ? `${adminClassesKey(me.userId)}list:${table.queryKey}` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    resourceKey,
    () => api.get<AdminClassPage>("/v1/admin/classes", { query: { page: table.page, pageSize: table.pageSize, q: table.q, setup } }),
    { keepPreviousData: true },
  );

  const [form, setForm] = useState({ open: false, key: 0 });
  const openCreate = () => setForm((current) => ({ open: true, key: current.key + 1 }));
  // The empty state's "ล้างตัวกรอง" removes itself: focus goes to the search box, not <body>.
  // (FilterBar's own button moves focus by itself.)
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resetFilters = () => {
    table.reset();
    focusSearchIn(toolbarRef.current);
  };

  const columns = useMemo<DataTableColumn<AdminClass>[]>(
    () => [
      {
        key: "title",
        header: t("classes.colClass"),
        sticky: true,
        alwaysVisible: true,
        mobile: "primary",
        // Identity: CEFR tile + class name + the book (was its own column).
        cell: (row) => (
          <IdentityCell
            leading={<IconTile icon={School} tone={classTileTone(row.bookTitle)} size="sm" />}
            name={row.title}
            secondary={
              <span title={row.bookTitle ?? undefined}>
                <span className="sr-only">{t("classes.colBook")}: </span>
                {row.bookCode ?? row.bookTitle ?? "–"}
              </span>
            }
            className="max-w-72"
          />
        ),
      },
      {
        key: "status",
        header: t("classes.colStatus"),
        mobile: "trailing",
        cell: (row) => (
          <span className="flex flex-col items-end gap-1 md:flex-row md:flex-wrap md:items-center">
            <AdminStatusChip domain="classStatus" status={row.status} />
            {row.setupRequired ? (
              <Chip tone="warning" size="sm" dot title={t("classes.setupChipHint")}>
                {t("classes.setupChip")}
              </Chip>
            ) : null}
            {row.isDemo ? (
              <Chip tone="neutral" size="sm">
                {t("classes.demoChip")}
              </Chip>
            ) : null}
          </span>
        ),
      },
      {
        key: "tutor",
        header: t("classes.colTutor"),
        mobile: "secondary",
        cell: (row) => <TutorCell tutor={row.tutor} />,
      },
      {
        key: "price",
        header: t("classes.colPrice"),
        align: "right",
        cell: (row) => <Money satang={row.packagePriceSatang} />,
      },
      {
        key: "students",
        header: t("classes.colStudents"),
        align: "right",
        cell: (row) => (
          <span className="whitespace-nowrap tabular" title={t("classes.studentsHint")}>
            {t("classes.studentsValue", { active: formatNumber(row.activeStudents), capacity: formatNumber(row.capacity) })}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("classes.colCreated"),
        cell: (row) => (
          <span className="whitespace-nowrap tabular" title={formatThaiDateTime(row.createdAt)}>
            {formatThaiDate(row.createdAt)}
          </span>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("classes.colActions")}</span>,
        label: t("classes.colActions"),
        align: "right",
        alwaysVisible: true,
        // Phones: a full-width row of labelled buttons at the bottom of the card (none for demo classes).
        mobile: "actions",
        cell: (row) =>
          row.isDemo ? null : (
            <RowActions label={t("classes.rowActions", { title: row.title })}>
              <RowAction icon={ClipboardCheck} label={t("classes.attendanceAction")} href={classAttendanceHref(row.classId)} />
              <RowAction icon={TicketPercent} label={t("classes.issueCodeAction")} href={discountCodeCreateHref(row.classId)} />
            </RowActions>
          ),
      },
    ],
    [],
  );
  const visibility = useColumnVisibility("classes", columns);

  const rows = data?.items ?? [];

  return (
    <Page>
      <PageHeader
        title={t("classes.pageTitle")}
        description={t("classes.pageDescription")}
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t("classes.createAction")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div ref={toolbarRef}>
          <FilterBar
            tabs={
              <SegmentedControl<SetupFilter>
                aria-label={t("classes.setupFilterLabel")}
                value={setup}
                onValueChange={(value) => table.setFilter("setup", value)}
                items={[
                  { value: "", label: t("classes.setupAll") },
                  { value: "pending", label: t("classes.setupPending") },
                ]}
              />
            }
            search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("classes.searchPlaceholder") }}
            isFiltered={table.isFiltered}
            onReset={table.reset}
            actions={<ColumnToggle id="classes-columns" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
          />
        </div>

        {error && !data ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <DataTable
            caption={t("classes.listTitle")}
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.classId}
            loading={isLoading || isValidating}
            hiddenColumns={visibility.hidden}
            empty={
              table.isFiltered ? (
                <EmptyState
                  icon={School}
                  title={t("classes.emptyFilteredTitle")}
                  description={t("classes.emptyFilteredDescription")}
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      {t("shell.clearFilters")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={School}
                  tone="brand"
                  title={t("classes.emptyTitle")}
                  description={t("classes.emptyFirstDescription")}
                  action={
                    // The header keeps the page's one primary; this is its tonal echo.
                    <Button variant="tonal" onClick={openCreate}>
                      <Plus aria-hidden="true" />
                      {t("classes.createAction")}
                    </Button>
                  }
                />
              )
            }
            footer={
              data && data.total > 0 ? (
                <Pagination
                  page={table.page}
                  pageSize={table.pageSize}
                  total={data.total}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                />
              ) : null
            }
          />
        )}
      </div>

      <CreateClassSheet
        key={form.key}
        open={form.open}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onCreated={() => {
          if (me) invalidateResource(adminClassesKey(me.userId));
        }}
      />
    </Page>
  );
}
