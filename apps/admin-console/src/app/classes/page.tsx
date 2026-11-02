"use client";

import Link from "next/link";
import { Plus, School, TicketPercent } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AdminStatusChip,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Money,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { adminClassesKey } from "../discount-codes/useClassLookup";
import { discountCodeCreateHref, type AdminClass, type AdminClassPage } from "./classForm";
import { CreateClassSheet } from "./components/CreateClassSheet";
import "@/locales/th/classes";

type SetupFilter = "" | "pending";

function TutorCell({ tutor }: { tutor: AdminClass["tutor"] }) {
  if (!tutor) return <span className="text-fg-muted">{t("classes.noTutor")}</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-center gap-1.5">
        <Link href={`/users/${encodeURIComponent(tutor.userId)}`} className="block max-w-48 truncate text-fg hover:underline">
          {tutor.displayName || t("classes.tutorUnnamed")}
        </Link>
        {tutor.pendingRegistration ? (
          <Chip tone="warning" size="sm" title={t("classes.pendingRegistrationHint")}>
            {t("classes.pendingRegistrationChip")}
          </Chip>
        ) : null}
      </span>
      {tutor.email ? <span className="block max-w-56 truncate text-[0.8125rem] text-fg-muted">{tutor.email}</span> : null}
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

  const columns = useMemo<DataTableColumn<AdminClass>[]>(
    () => [
      {
        key: "title",
        header: t("classes.colClass"),
        sticky: true,
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <span className="flex min-w-0 flex-col gap-1">
            <span className="block max-w-64 truncate font-medium text-fg" title={row.title}>
              {row.title}
            </span>
            {row.setupRequired || row.isDemo ? (
              <span className="flex flex-wrap gap-1">
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
            ) : null}
          </span>
        ),
      },
      {
        key: "status",
        header: t("classes.colStatus"),
        mobile: "trailing",
        cell: (row) => <AdminStatusChip domain="classStatus" status={row.status} />,
      },
      {
        key: "tutor",
        header: t("classes.colTutor"),
        mobile: "secondary",
        cell: (row) => <TutorCell tutor={row.tutor} />,
      },
      {
        key: "book",
        header: t("classes.colBook"),
        cell: (row) => (
          <span className="block max-w-48 truncate" title={row.bookTitle ?? undefined}>
            {row.bookCode ?? row.bookTitle ?? "–"}
          </span>
        ),
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
          <span className="whitespace-nowrap" title={formatThaiDateTime(row.createdAt)}>
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
        cell: (row) =>
          row.isDemo ? null : (
            <span role="group" aria-label={t("classes.rowActions", { title: row.title })} className="flex justify-end">
              <Button asChild size="sm" variant="ghost">
                <Link href={discountCodeCreateHref(row.classId)}>
                  <TicketPercent aria-hidden="true" />
                  {t("classes.issueCodeAction")}
                </Link>
              </Button>
            </span>
          ),
      },
    ],
    [],
  );

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
        <FilterBar
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("classes.searchPlaceholder") }}
          isFiltered={table.isFiltered}
          onReset={table.reset}
        >
          <SegmentedControl<SetupFilter>
            aria-label={t("classes.setupFilterLabel")}
            value={setup}
            onValueChange={(value) => table.setFilter("setup", value)}
            items={[
              { value: "", label: t("classes.setupAll") },
              { value: "pending", label: t("classes.setupPending") },
            ]}
          />
        </FilterBar>

        {error && !data ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <DataTable
            caption={t("classes.listTitle")}
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.classId}
            loading={isLoading || isValidating}
            empty={
              table.isFiltered ? (
                <EmptyState
                  compact
                  icon={School}
                  title={t("classes.emptyFilteredTitle")}
                  description={t("classes.emptyFilteredDescription")}
                  action={
                    <Button variant="outline" onClick={table.reset}>
                      {t("shell.clearFilters")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={School}
                  title={t("classes.emptyTitle")}
                  description={t("classes.emptyFirstDescription")}
                  action={
                    <Button onClick={openCreate}>
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
