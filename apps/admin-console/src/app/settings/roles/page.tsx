"use client";

import { useMemo, useState } from "react";
import { Plus, ShieldCheck, ShieldOff, UserCog, Users } from "lucide-react";
import {
  AdminStatusChip,
  Card,
  CardHeader,
  Chip,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  Grid,
  Notice,
  Page,
  PageHeader,
  SegmentedControl,
  Sheet,
  StatCard,
  TextField,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { api, newIdempotencyKey } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import "@/locales/th/roles";
import "@/locales/th/users";

type StaffRole = "ADMIN" | "FINANCE_CHECKER";

interface StaffUser {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: StaffRole;
  isActive: boolean;
  createdAt?: string;
  pendingRegistration?: boolean;
  isSelf?: boolean;
}

interface RoleChange {
  email: string;
  role: StaffRole;
  active: boolean;
  current: StaffUser | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function changeKind(change: RoleChange): "provision" | "revoke" | "restore" | "change" {
  if (!change.current) return "provision";
  if (!change.active) return "revoke";
  if (!change.current.isActive) return "restore";
  return "change";
}

function grantsAdmin(change: RoleChange) {
  return change.active && change.role === "ADMIN" && !(change.current?.role === "ADMIN" && change.current.isActive);
}

export default function RolesPage() {
  const me = useAdminSession();
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("FINANCE_CHECKER");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<RoleChange | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const key = me ? `${me.userId}:roles:staff` : null;
  const { data, error, isLoading, refetch, mutate } = useCachedResource(key, () => api.get<StaffUser[]>("/v1/admin/roles"));
  const staff = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const activeAdmins = staff.filter((u) => u.role === "ADMIN" && u.isActive).length;
  const activeCheckers = staff.filter((u) => u.role === "FINANCE_CHECKER" && u.isActive).length;
  const revoked = staff.filter((u) => !u.isActive).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    // Null-safe: shell accounts may have no display name; LINE-only users have no email.
    return staff.filter((u) => (u.email ?? "").toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q));
  }, [staff, search]);

  const ask = (change: RoleChange) => {
    setIdempotencyKey(newIdempotencyKey());
    setPending(change);
  };

  const isLastActiveAdmin = (u: StaffUser) => u.role === "ADMIN" && u.isActive && activeAdmins <= 1;

  const columns: DataTableColumn<StaffUser>[] = [
    {
      key: "staff",
      header: t("roles.colStaff"),
      mobile: "primary",
      alwaysVisible: true,
      cell: (u) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 truncate font-medium text-fg">
            {u.displayName && u.displayName !== u.email ? u.displayName : u.email ?? PLACEHOLDER}
            {u.isSelf ? (
              <Chip tone="brand" size="sm">
                {t("roles.you")}
              </Chip>
            ) : null}
          </span>
          <span className="truncate text-[0.8125rem] text-fg-muted">
            {u.email ?? PLACEHOLDER}
            {u.pendingRegistration ? ` · ${t("roles.pendingLogin")}` : ""}
          </span>
        </span>
      ),
    },
    { key: "role", header: t("roles.colRole"), mobile: "secondary", width: "170px", cell: (u) => <AdminStatusChip domain="userRole" status={u.role} /> },
    {
      key: "access",
      header: t("roles.colAccess"),
      mobile: "trailing",
      width: "130px",
      cell: (u) => (
        <Chip tone={u.isActive ? "success" : "neutral"} size="sm" dot>
          {u.isActive ? t("roles.accessActive") : t("roles.accessRevoked")}
        </Chip>
      ),
    },
    { key: "createdAt", header: t("roles.colAddedAt"), width: "130px", cell: (u) => formatThaiDate(u.createdAt) },
    {
      key: "actions",
      header: t("roles.colActions"),
      align: "right",
      cell: (u) => {
        if (u.isSelf || !u.email) return <span className="text-[0.8125rem] text-fg-subtle">{u.isSelf ? t("roles.ruleNoSelf") : PLACEHOLDER}</span>;
        const email = u.email;
        const locked = isLastActiveAdmin(u);
        return (
          <span className="flex flex-wrap justify-end gap-2">
            {u.isActive ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  onClick={() => ask({ email, role: u.role === "ADMIN" ? "FINANCE_CHECKER" : "ADMIN", active: true, current: u })}
                >
                  <UserCog aria-hidden="true" /> {u.role === "ADMIN" ? t("roles.makeChecker") : t("roles.makeAdmin")}
                </Button>
                <Button size="sm" variant="destructive" disabled={locked} onClick={() => ask({ email, role: u.role, active: false, current: u })}>
                  <ShieldOff aria-hidden="true" /> {t("roles.revoke")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="soft" onClick={() => ask({ email, role: u.role, active: true, current: u })}>
                <ShieldCheck aria-hidden="true" /> {t("roles.restore")}
              </Button>
            )}
          </span>
        );
      },
    },
  ];

  const openAdd = () => {
    setFormEmail("");
    setFormRole("FINANCE_CHECKER");
    setFormError(null);
    setSheetOpen(true);
  };

  const reviewAdd = () => {
    const email = formEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setFormError(t("roles.emailRequired"));
      return;
    }
    const current = staff.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
    setSheetOpen(false);
    ask({ email, role: formRole, active: true, current });
  };

  const submit = async ({ reason }: { reason: string }) => {
    if (!pending) return;
    const result = await api.post<StaffUser & { change?: string }>(
      "/v1/admin/roles",
      { email: pending.email, role: pending.role, active: pending.active, reason },
      { idempotencyKey },
    );
    const kind = changeKind(pending);
    toast.success(
      result.change === "UNCHANGED"
        ? t("roles.savedUnchanged")
        : kind === "provision"
          ? t("roles.savedProvision")
          : kind === "revoke"
            ? t("roles.savedRevoke")
            : kind === "restore"
              ? t("roles.savedRestore")
              : t("roles.savedChange"),
    );
    mutate((list) => {
      const next = (list ?? []).filter((u) => u.userId !== result.userId);
      return [...next, { ...pending.current, ...result, isSelf: false } as StaffUser];
    }, { revalidate: true });
  };

  const kind = pending ? changeKind(pending) : "change";
  const dialogTitle = !pending
    ? ""
    : grantsAdmin(pending)
      ? t("roles.confirmGrantAdminTitle")
      : kind === "provision"
        ? t("roles.confirmProvisionTitle")
        : kind === "revoke"
          ? t("roles.confirmRevokeTitle")
          : kind === "restore"
            ? t("roles.confirmRestoreTitle")
            : t("roles.confirmChangeTitle");

  return (
    <Page>
      <PageHeader
        title={t("roles.pageTitle")}
        description={t("roles.pageDescription")}
        actions={
          <Button onClick={openAdd}>
            <Plus aria-hidden="true" /> {t("roles.addStaff")}
          </Button>
        }
      />

      <Grid cols={3}>
        <StatCard label={t("roles.statAdmins")} value={data ? formatNumber(activeAdmins) : "–"} icon={ShieldCheck} tone="brand" />
        <StatCard label={t("roles.statCheckers")} value={data ? formatNumber(activeCheckers) : "–"} icon={Users} tone="blue" />
        <StatCard label={t("roles.statRevoked")} value={data ? formatNumber(revoked) : "–"} icon={ShieldOff} tone="neutral" />
      </Grid>

      {data && activeAdmins <= 1 ? <Notice tone="warning">{t("roles.lastAdminNotice")}</Notice> : null}

      <FilterBar search={{ value: search, onValueChange: setSearch, placeholder: t("roles.searchPlaceholder") }} isFiltered={search !== ""} onReset={() => setSearch("")} />

      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("roles.tableCaption")}
          columns={columns}
          rows={rows}
          loading={isLoading}
          getRowKey={(u) => u.userId}
          empty={<EmptyState icon={Users} title={search ? t("users.emptyTitle") : t("roles.emptyStaff")} compact />}
        />
      )}

      <Card padding="md" tone="muted">
        <CardHeader title={t("roles.rulesTitle")} className="mb-2" />
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-fg-muted">
          <li>{t("roles.ruleStaffOnly")}</li>
          <li>{t("roles.ruleNoSelf")}</li>
          <li>{t("roles.ruleLastAdmin")}</li>
        </ul>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t("roles.addSheetTitle")}
        description={t("roles.addSheetDescription")}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setSheetOpen(false)}>
              {t("shell.cancel")}
            </Button>
            <Button onClick={reviewAdd}>{t("roles.continue")}</Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            reviewAdd();
          }}
        >
          <TextField
            label={t("roles.emailLabel")}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={t("roles.emailPlaceholder")}
            value={formEmail}
            error={formError ?? undefined}
            onChange={(event) => {
              setFormEmail(event.target.value);
              setFormError(null);
            }}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("roles.roleFieldLabel")}</span>
            <SegmentedControl<StaffRole>
              aria-label={t("roles.roleFieldLabel")}
              fullWidth
              value={formRole}
              onValueChange={setFormRole}
              items={[
                { value: "FINANCE_CHECKER", label: statusLabel("userRole", "FINANCE_CHECKER") },
                { value: "ADMIN", label: statusLabel("userRole", "ADMIN") },
              ]}
            />
          </div>
        </form>
      </Sheet>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={dialogTitle}
        description={
          pending && grantsAdmin(pending)
            ? t("roles.confirmGrantAdminBody")
            : kind === "revoke"
              ? t("roles.confirmRevokeBody")
              : undefined
        }
        confirmLabel={
          kind === "revoke" ? t("roles.revoke") : kind === "restore" ? t("roles.restore") : t("roles.submitBtn")
        }
        tone={pending && (grantsAdmin(pending) || kind === "revoke") ? "danger" : "brand"}
        requireText={pending && grantsAdmin(pending) ? pending.email : undefined}
        reason={{ label: t("roles.reasonLabel"), placeholder: t("roles.reasonPlaceholder"), minLength: 5 }}
        details={
          pending ? (
            <DescriptionList
              items={[
                { label: t("roles.detailEmail"), value: pending.email, wide: true },
                {
                  label: t("roles.detailFrom"),
                  value: pending.current
                    ? `${statusLabel("userRole", pending.current.role)}${pending.current.isActive ? "" : ` (${t("roles.accessRevoked")})`}`
                    : t("roles.detailNotStaff"),
                },
                {
                  label: t("roles.detailTo"),
                  value: pending.active ? statusLabel("userRole", pending.role) : t("roles.accessRevoked"),
                },
              ]}
            />
          ) : null
        }
        onConfirm={submit}
      />
    </Page>
  );
}
