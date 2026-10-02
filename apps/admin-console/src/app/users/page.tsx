"use client";

import { FileSearch, GraduationCap, UserRound, Users } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Grid,
  Page,
  PageHeader,
  Pagination,
  SelectField,
  StatCard,
  UserAvatar,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import type { UserListItem, UserListResponse } from "./types";

const ROLE_OPTIONS = [
  { value: "", label: t("users.roleAll") },
  { value: "TUTOR", label: statusLabel("userRole", "TUTOR") },
  { value: "STUDENT", label: statusLabel("userRole", "STUDENT") },
];
const ACCOUNT_OPTIONS = [
  { value: "", label: t("users.accountAll") },
  { value: "ACTIVE", label: statusLabel("account", "ACTIVE") },
  { value: "SUSPENDED", label: statusLabel("account", "SUSPENDED") },
  { value: "ANONYMIZED", label: statusLabel("account", "ANONYMIZED") },
];
const VERIFICATION_OPTIONS = [
  { value: "", label: t("users.verificationAll") },
  { value: "REVIEW", label: t("users.verificationReview") },
  { value: "UNVERIFIED", label: statusLabel("verification", "UNVERIFIED") },
  { value: "PENDING", label: statusLabel("verification", "PENDING") },
  { value: "VERIFIED", label: statusLabel("verification", "VERIFIED") },
  { value: "REJECTED", label: statusLabel("verification", "REJECTED") },
];

function VerificationCell({ user }: { user: UserListItem }) {
  if (user.role !== "TUTOR") {
    return user.guardianSetup ? (
      <span className="text-fg-subtle">{t("users.notApplicable")}</span>
    ) : (
      <Chip tone="warning" size="sm" dot>
        {t("users.guardianMissing")}
      </Chip>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <AdminStatusChip domain="verification" status={user.verificationStatus} />
      {user.pendingVerificationCount > 0 ? (
        <Chip tone="warning" size="sm">
          {t("users.pendingFields", { count: user.pendingVerificationCount })}
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
    cell: (user) => (
      <span className="flex min-w-0 items-center gap-3">
        <UserAvatar name={user.name ?? ""} src={user.profilePictureUrl} size="sm" className="hidden md:inline-flex" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{user.displayName || t("users.unnamed")}</span>
          <span className="truncate text-[0.8125rem] text-fg-muted">{user.email ?? t("users.noEmail")}</span>
        </span>
      </span>
    ),
  },
  {
    key: "role",
    header: t("users.colRole"),
    mobile: "secondary",
    width: "120px",
    cell: (user) => <AdminStatusChip domain="userRole" status={user.role} />,
  },
  {
    key: "verification",
    header: t("users.colVerification"),
    cell: (user) => <VerificationCell user={user} />,
  },
  {
    key: "account",
    header: t("users.colAccount"),
    mobile: "trailing",
    width: "130px",
    cell: (user) => <AdminStatusChip domain="account" status={user.accountStatus} />,
  },
  {
    key: "classes",
    header: t("users.colClasses"),
    align: "right",
    width: "90px",
    cell: (user) => formatNumber(user.activeClasses),
  },
  {
    key: "createdAt",
    header: t("users.colJoined"),
    sortable: true,
    width: "140px",
    cell: (user) => formatThaiDate(user.createdAt),
  },
];

export default function UsersPage() {
  const me = useAdminSession();
  const table = useTableState({
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt", "name"],
    filterKeys: ["role", "status", "verification"],
  });

  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    me ? `${me.userId}:users:list:${table.queryKey}` : null,
    () => api.get<UserListResponse>("/v1/users", { query: table.apiQuery }),
    { keepPreviousData: true },
  );

  const counts = data?.counts;
  const reviewHref = "/users?role=TUTOR&verification=REVIEW";

  return (
    <Page>
      <PageHeader title={t("users.pageTitle")} description={t("users.pageDescription")} />

      <Grid cols={4} className="grid-cols-2">
        <StatCard label={t("users.statTotal")} value={counts ? formatNumber(counts.all) : "–"} icon={Users} tone="brand" />
        <StatCard label={t("users.statTutors")} value={counts ? formatNumber(counts.tutors) : "–"} icon={UserRound} tone="purple" href="/users?role=TUTOR" />
        <StatCard label={t("users.statStudents")} value={counts ? formatNumber(counts.students) : "–"} icon={GraduationCap} tone="teal" href="/users?role=STUDENT" />
        <StatCard
          label={t("users.statReview")}
          value={counts ? formatNumber(counts.pendingReview) : "–"}
          icon={FileSearch}
          tone="amber"
          hint={t("users.statReviewHint")}
          href={reviewHref}
        />
      </Grid>

      <FilterBar
        search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("users.searchHint") }}
        isFiltered={table.isFiltered}
        onReset={table.reset}
      >
        <SelectField
          aria-label={t("users.filterRole")}
          containerClassName="w-full sm:w-40"
          value={table.filters.role ?? ""}
          onChange={(event) => table.setFilter("role", event.target.value)}
          options={ROLE_OPTIONS}
        />
        <SelectField
          aria-label={t("users.filterVerification")}
          containerClassName="w-full sm:w-48"
          value={table.filters.verification ?? ""}
          onChange={(event) => table.setFilter("verification", event.target.value)}
          options={VERIFICATION_OPTIONS}
        />
        <SelectField
          aria-label={t("users.filterAccount")}
          containerClassName="w-full sm:w-44"
          value={table.filters.status ?? ""}
          onChange={(event) => table.setFilter("status", event.target.value)}
          options={ACCOUNT_OPTIONS}
        />
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("users.tableCaption")}
          columns={columns}
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
