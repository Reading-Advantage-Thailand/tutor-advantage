"use client";

import { useRef } from "react";
import { GraduationCap, Presentation, UserRound, Users } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  ColumnToggle,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  IdentityCell,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  useAdminSession,
  useColumnVisibility,
  type DataTableColumn,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, ApiError } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { InlineFilters, userMoreFilters } from "./components/UserFilters";
import { documentExpiryChip, type ExpiryMessages } from "./documentExpiry";
import type { UserListItem, UserListResponse } from "./types";
import "@/locales/th/users";

/** Count tabs (patterns.md A2): they replace the four KPI tiles and the role select. */
type RoleTab = "all" | "tutor" | "student" | "review";

const EXPIRY_MESSAGES: ExpiryMessages = {
  passport: t("users.docPassport"),
  workPermit: t("users.docWorkPermit"),
  inDays: t("users.expiryInDays"),
  today: t("users.expiryToday"),
  expired: t("users.expiryExpired"),
};

/**
 * Role as an icon + word (not a chip: a role is not a status). On phones the
 * row is a list row (identity, one status chip, chevron), so this line also
 * carries the class count that the table shows in its own column.
 */
function RoleCell({ user }: { user: UserListItem }) {
  const Icon = user.role === "TUTOR" ? Presentation : user.role === "STUDENT" ? GraduationCap : UserRound;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-fg-muted">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {statusLabel("userRole", user.role)}
      </span>
      <span className="whitespace-nowrap md:hidden">· {t("users.classesCount", { count: formatNumber(user.activeClasses) })}</span>
    </span>
  );
}

function VerificationCell({ user }: { user: UserListItem }) {
  if (user.role !== "TUTOR") {
    return user.guardianSetup ? (
      <span className="block text-fg-subtle">{t("users.notApplicable")}</span>
    ) : (
      <span className="flex">
        <Chip tone="warning" size="sm" dot>
          {t("users.guardianMissing")}
        </Chip>
      </span>
    );
  }
  const expiry = documentExpiryChip(user.documentExpiry, EXPIRY_MESSAGES);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <AdminStatusChip domain="verification" status={user.verificationStatus} />
      {user.pendingVerificationCount > 0 ? (
        <Chip tone="warning" size="sm">
          {t("users.pendingFields", { count: user.pendingVerificationCount })}
        </Chip>
      ) : null}
      {expiry ? (
        <Chip tone={expiry.tone} size="sm" dot>
          {expiry.text}
        </Chip>
      ) : null}
    </span>
  );
}

const columns: DataTableColumn<UserListItem>[] = [
  {
    key: "name",
    header: t("users.colUser"),
    sortable: true,
    mobile: "primary",
    alwaysVisible: true,
    sticky: true,
    cell: (user) => (
      <IdentityCell
        name={user.displayName || t("users.unnamed")}
        secondary={user.email ?? t("users.noEmail")}
        avatarSrc={user.profilePictureUrl}
        seed={user.id}
      />
    ),
  },
  {
    key: "role",
    header: t("users.colRole"),
    mobile: "secondary",
    width: "112px",
    cell: (user) => <RoleCell user={user} />,
  },
  {
    key: "verification",
    header: t("users.colVerification"),
    mobile: "secondary",
    cell: (user) => <VerificationCell user={user} />,
  },
  {
    key: "account",
    header: t("users.colAccount"),
    mobile: "trailing",
    width: "124px",
    cell: (user) => <AdminStatusChip domain="account" status={user.accountStatus} />,
  },
  {
    key: "classes",
    header: t("users.colClasses"),
    align: "right",
    width: "76px",
    mobile: "hidden",
    cell: (user) => formatNumber(user.activeClasses),
  },
  {
    key: "createdAt",
    header: t("users.colJoined"),
    sortable: true,
    width: "128px",
    // Phones: under the account chip, small and muted (the column header is not shown there).
    mobile: "trailing",
    cell: (user) => (
      <span className="whitespace-nowrap tabular max-md:text-[0.8125rem] max-md:font-normal max-md:text-fg-muted">
        <span className="sr-only md:hidden">{t("users.colJoined")} </span>
        {formatThaiDate(user.createdAt)}
      </span>
    ),
  },
];

export default function UsersPage() {
  const me = useAdminSession();
  const table = useTableState({
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt", "name"],
    filterKeys: ["role", "status", "verification", "documents"],
  });
  const visibility = useColumnVisibility("users", columns);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    me ? `${me.userId}:users:list:${table.queryKey}` : null,
    () => api.get<UserListResponse>("/v1/users", { query: table.apiQuery }),
    { keepPreviousData: true },
  );

  const counts = data?.counts;
  const role = table.filters.role ?? "";
  const verification = table.filters.verification ?? "";
  const tab: RoleTab =
    role === "TUTOR" ? (verification === "REVIEW" ? "review" : "tutor") : role === "STUDENT" ? "student" : "all";

  // Same URL state as the old role select and the review KPI link (/users?role=TUTOR&verification=REVIEW).
  const selectTab = (next: RoleTab) => {
    if (next === "review") {
      table.setFilters({ role: "TUTOR", verification: "REVIEW" });
      return;
    }
    table.setFilters({
      role: next === "tutor" ? "TUTOR" : next === "student" ? "STUDENT" : "",
      verification: verification === "REVIEW" ? "" : verification,
    });
  };

  return (
    <Page>
      <PageHeader title={t("users.pageTitle")} description={t("users.pageDescription")} />

      <div ref={toolbarRef}>
        <FilterBar
          tabs={
            <SegmentedControl
              aria-label={t("users.filterRole")}
              value={tab}
              onValueChange={selectTab}
              items={[
                { value: "all", label: t("users.tabAll"), count: counts?.all },
                { value: "tutor", label: t("users.tabTutor"), count: counts?.tutors },
                { value: "student", label: t("users.tabStudent"), count: counts?.students },
                { value: "review", label: t("users.tabPendingDocs"), count: counts?.pendingReview },
              ]}
            />
          }
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("users.searchHint") }}
          moreFilters={userMoreFilters(table)}
          isFiltered={table.isFiltered}
          onReset={table.reset}
          actions={
            <ColumnToggle id="users-columns" compact="2xl" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />
          }
        >
          <InlineFilters table={table} />
        </FilterBar>
      </div>

      {error && !data ? (
        <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />
      ) : (
        <DataTable
          caption={t("users.tableCaption")}
          columns={columns}
          hiddenColumns={visibility.hidden}
          rows={data?.items ?? []}
          getRowKey={(user) => user.id}
          rowHref={(user) => `/users/${user.id}`}
          loading={isLoading || isValidating}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            <EmptyState
              icon={Users}
              title={t("users.emptyTitle")}
              description={table.isFiltered ? t("users.emptyFiltered") : undefined}
              action={
                table.isFiltered ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      table.reset();
                      // The empty state (and this button) goes away: keep focus in the toolbar.
                      toolbarRef.current?.querySelector<HTMLElement>('input[type="search"]')?.focus();
                    }}
                  >
                    {t("shell.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
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

    </Page>
  );
}
