"use client";

import { Calculator, GraduationCap, Pencil, Plus, Presentation, ShieldCheck, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  AdminStatusChip,
  ColumnToggle,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  IdCell,
  IdentityCell,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  Sheet,
  TextField,
  useAdminSession,
  useColumnVisibility,
  type DataTableColumn,
} from "@/components/app";
import { Chip } from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, ApiError, errorMessage } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel, statusOptions } from "@/lib/status";
import "@/locales/th/dev";

const ROLES = ["ADMIN", "FINANCE_CHECKER", "TUTOR", "STUDENT"] as const;
const VERIFICATION = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;
type Role = (typeof ROLES)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_ICON: Record<Role, LucideIcon> = {
  ADMIN: ShieldCheck,
  FINANCE_CHECKER: Calculator,
  TUTOR: Presentation,
  STUDENT: GraduationCap,
};

/** Role as icon + word (patterns.md A2), not a coloured chip. */
function RoleCell({ role }: { role: Role }) {
  const Icon = ROLE_ICON[role] ?? UserRound;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {statusLabel("userRole", role)}
    </span>
  );
}

interface DevUser {
  userId: string;
  role: Role;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  verificationStatus: string;
  verificationComment: string | null;
  sponsorTutorId: string | null;
  createdAt: string;
  oauthIdentities: { provider: string }[];
}

interface FormState {
  role: Role;
  displayName: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
  verificationStatus: string;
  verificationComment: string;
  sponsorTutorId: string;
}

const BLANK: FormState = {
  role: "STUDENT",
  displayName: "",
  email: "",
  phoneNumber: "",
  isActive: true,
  verificationStatus: "UNVERIFIED",
  verificationComment: "",
  sponsorTutorId: "",
};

function toForm(user: DevUser): FormState {
  return {
    role: user.role,
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    phoneNumber: user.phoneNumber ?? "",
    isActive: user.isActive,
    verificationStatus: user.verificationStatus,
    verificationComment: user.verificationComment ?? "",
    sponsorTutorId: user.sponsorTutorId ?? "",
  };
}

function UserFormSheet({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: DevUser | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => (user ? toForm(user) : BLANK));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t("dev.formEmailInvalid");
    if (form.sponsorTutorId && !UUID_RE.test(form.sponsorTutorId.trim())) next.sponsorTutorId = t("dev.formSponsorInvalid");
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = {
      role: form.role,
      displayName: form.displayName.trim() || null,
      email: form.email.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      isActive: form.isActive,
      verificationStatus: form.verificationStatus,
      verificationComment: form.verificationComment.trim() || null,
      sponsorTutorId: form.sponsorTutorId.trim() || null,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      if (user) await api.patch(`/v1/dev/users/${user.userId}`, body);
      else await api.post("/v1/dev/users", body);
      toast.success(user ? t("dev.updated") : t("dev.created"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      dismissible={!saving}
      title={user ? t("dev.editTitle") : t("dev.createTitle")}
      description={user ? <IdCell id={user.userId} /> : undefined}
      footer={
        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t("dev.close")}
          </Button>
          <Button type="submit" form="dev-user-form" loading={saving}>
            {user ? t("dev.save") : t("dev.create")}
          </Button>
        </div>
      }
    >
      <form id="dev-user-form" noValidate onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label={t("dev.formRole")}
          required
          value={form.role}
          onChange={(event) => set("role", event.target.value as Role)}
          options={statusOptions("userRole").filter((option) => (ROLES as readonly string[]).includes(option.value))}
        />
        <SelectField
          label={t("dev.formActive")}
          value={form.isActive ? "true" : "false"}
          onChange={(event) => set("isActive", event.target.value === "true")}
          options={[
            { value: "true", label: t("dev.formActiveYes") },
            { value: "false", label: t("dev.formActiveNo") },
          ]}
        />
        <TextField label={t("dev.formName")} optional value={form.displayName} onChange={(event) => set("displayName", event.target.value)} />
        <TextField
          label={t("dev.formEmail")}
          optional
          type="email"
          inputMode="email"
          value={form.email}
          error={errors.email}
          onChange={(event) => set("email", event.target.value)}
        />
        <TextField label={t("dev.formPhone")} optional inputMode="tel" value={form.phoneNumber} onChange={(event) => set("phoneNumber", event.target.value)} />
        <SelectField
          label={t("dev.formVerification")}
          value={form.verificationStatus}
          onChange={(event) => set("verificationStatus", event.target.value)}
          options={statusOptions("verification").filter((option) => (VERIFICATION as readonly string[]).includes(option.value))}
        />
        <TextField
          label={t("dev.formVerificationComment")}
          optional
          containerClassName="sm:col-span-2"
          value={form.verificationComment}
          onChange={(event) => set("verificationComment", event.target.value)}
        />
        <TextField
          label={t("dev.formSponsor")}
          optional
          containerClassName="sm:col-span-2"
          className="font-mono"
          value={form.sponsorTutorId}
          error={errors.sponsorTutorId}
          onChange={(event) => set("sponsorTutorId", event.target.value)}
        />
        {submitError ? (
          <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg sm:col-span-2">
            {submitError}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

export function DevUsersClient() {
  const me = useAdminSession();
  const table = useTableState({ filterKeys: ["role"], defaultPageSize: 20 });
  const key = me ? `${me.userId}:dev-users` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(key, () =>
    api.get<{ users: DevUser[] }>("/v1/dev/users"),
  );
  const [form, setForm] = useState<{ open: boolean; user: DevUser | null; key: number }>({ open: false, user: null, key: 0 });
  const [deleting, setDeleting] = useState<DevUser | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The empty state's "ล้างตัวกรอง" disappears once it has worked: focus goes back to the search box.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    window.requestAnimationFrame(() => toolbarRef.current?.querySelector<HTMLElement>('input[type="search"]')?.focus());
  };
  const refresh = () => {
    if (me) invalidateResource(`${me.userId}:dev-users`);
  };

  // Dev list is small and unpaged on the server: filter + page locally (URL state still via useTableState).
  const filtered = useMemo(() => {
    const q = table.q.trim().toLowerCase();
    return (data?.users ?? []).filter((user) => {
      if (table.filters.role && user.role !== table.filters.role) return false;
      if (!q) return true;
      return [user.userId, user.displayName ?? "", user.email ?? ""].some((value) => value.toLowerCase().includes(q));
    });
  }, [data, table.q, table.filters.role]);
  const rows = filtered.slice((table.page - 1) * table.pageSize, table.page * table.pageSize);

  // Count tabs replace the role select (same `role` filter); counts follow the search.
  const roleCounts = useMemo(() => {
    const q = table.q.trim().toLowerCase();
    const counts: Record<string, number> = { "": 0 };
    for (const user of data?.users ?? []) {
      if (q && ![user.userId, user.displayName ?? "", user.email ?? ""].some((value) => value.toLowerCase().includes(q))) continue;
      counts[""] += 1;
      counts[user.role] = (counts[user.role] ?? 0) + 1;
    }
    return counts;
  }, [data, table.q]);
  const roleTabs = [
    { value: "", label: t("dev.allRoles"), count: data ? roleCounts[""] : undefined },
    ...statusOptions("userRole")
      .filter((option) => (ROLES as readonly string[]).includes(option.value))
      .map((option) => ({ value: option.value, label: option.label, count: data ? (roleCounts[option.value] ?? 0) : undefined })),
  ];

  const columns = useMemo<DataTableColumn<DevUser>[]>(
    () => [
      {
        key: "user",
        header: t("dev.colUser"),
        mobile: "primary",
        alwaysVisible: true,
        sticky: true,
        cell: (user) => (
          <IdentityCell name={user.displayName || t("dev.noName")} secondary={user.email || "–"} seed={user.userId} className="max-w-52" />
        ),
      },
      { key: "role", header: t("dev.colRole"), mobile: "trailing", cell: (user) => <RoleCell role={user.role} /> },
      {
        key: "account",
        header: t("dev.colAccount"),
        cell: (user) => <AdminStatusChip domain="account" status={user.isActive ? "ACTIVE" : "SUSPENDED"} />,
      },
      {
        key: "verification",
        header: t("dev.colVerification"),
        cell: (user) => <AdminStatusChip domain="verification" status={user.verificationStatus} />,
      },
      {
        key: "login",
        header: t("dev.colLogin"),
        cell: (user) =>
          user.oauthIdentities.length ? (
            <span className="whitespace-nowrap text-fg-muted">{user.oauthIdentities.map((identity) => identity.provider).join(" · ")}</span>
          ) : (
            <span className="text-fg-subtle">–</span>
          ),
      },
      { key: "id", header: t("dev.colId"), cell: (user) => <IdCell id={user.userId} /> },
      {
        key: "createdAt",
        header: t("dev.colCreated"),
        mobile: "secondary",
        cell: (user) => <span className="whitespace-nowrap tabular">{formatThaiDate(user.createdAt)}</span>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("dev.colActions")}</span>,
        label: t("dev.colActions"),
        align: "right",
        alwaysVisible: true,
        // Phones: a full-width row at the bottom of the card, not a half-width "จัดการ" field.
        mobile: "actions",
        cell: (user) => (
          <span className="inline-flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setForm((current) => ({ open: true, user, key: current.key + 1 }))}>
              <Pencil aria-hidden="true" />
              {t("dev.edit")}
            </Button>
            <Button size="sm" variant="destructive" disabled={user.userId === me?.userId} onClick={() => setDeleting(user)}>
              <Trash2 aria-hidden="true" />
              {t("dev.delete")}
            </Button>
          </span>
        ),
      },
    ],
    [me?.userId],
  );
  const visibility = useColumnVisibility("dev-users", columns);

  const deleteConfirmText = deleting ? deleting.email || deleting.userId.slice(0, 8) : "";

  return (
    <Page>
      <PageHeader
        title={t("dev.usersTitle")}
        description={t("dev.usersDescription")}
        meta={<Chip tone="warning">{t("dev.devOnlyBadge")}</Chip>}
        actions={
          <Button onClick={() => setForm((current) => ({ open: true, user: null, key: current.key + 1 }))}>
            <Plus aria-hidden="true" />
            {t("dev.newUser")}
          </Button>
        }
      />
      <Notice tone="warning">{t("dev.usersWarning")}</Notice>
      <div ref={toolbarRef} className="flex flex-col gap-3">
        <FilterBar
          tabs={
            <SegmentedControl
              aria-label={t("dev.roleFilter")}
              value={table.filters.role ?? ""}
              onValueChange={(next) => table.setFilter("role", next)}
              items={roleTabs}
            />
          }
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("dev.searchPlaceholder") }}
          isFiltered={table.isFiltered}
          onReset={table.reset}
          actions={<ColumnToggle id="dev-users-columns" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
        />
      </div>
      {error && !data ? (
        <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />
      ) : (
        <DataTable
          caption={t("dev.usersTitle")}
          rows={rows}
          columns={columns}
          hiddenColumns={visibility.hidden}
          getRowKey={(user) => user.userId}
          breakpoint="lg"
          loading={isLoading || isValidating}
          activeRowKey={form.open ? (form.user?.userId ?? null) : null}
          empty={
            <EmptyState
              icon={UserRound}
              title={t("dev.usersEmptyTitle")}
              description={t("dev.usersEmptyDescription")}
              action={
                table.isFiltered ? (
                  <Button variant="outline" onClick={resetFilters}>
                    {t("shell.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          }
          footer={
            filtered.length > 0 ? (
              <Pagination
                page={table.page}
                pageSize={table.pageSize}
                total={filtered.length}
                onPageChange={table.setPage}
                onPageSizeChange={table.setPageSize}
              />
            ) : null
          }
        />
      )}

      <UserFormSheet
        key={form.key}
        open={form.open}
        user={form.user}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        // The row (and its "ลบ" button) is gone after the refresh: focus goes to the search box, not <body>.
        finalFocus={() => toolbarRef.current?.querySelector<HTMLElement>('input[type="search"]')}
        tone="danger"
        title={deleting ? t("dev.deleteTitle", { name: deleting.displayName || deleting.email || t("dev.noName") }) : ""}
        description={t("dev.deleteDescription")}
        irreversible
        details={
          deleting ? (
            <DescriptionList
              columns={2}
              items={[
                { label: t("dev.colRole"), value: <AdminStatusChip domain="userRole" status={deleting.role} /> },
                { label: t("dev.colId"), value: <IdCell id={deleting.userId} /> },
              ]}
            />
          ) : null
        }
        requireText={deleteConfirmText}
        confirmLabel={t("dev.deleteConfirm")}
        cancelLabel={t("dev.close")}
        onConfirm={async () => {
          if (!deleting) return;
          await api.delete(`/v1/dev/users/${deleting.userId}`);
          toast.success(t("dev.deleted"));
          refresh();
        }}
      />
    </Page>
  );
}
