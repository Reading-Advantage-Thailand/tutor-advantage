"use client";

import { useMemo, useRef, useState } from "react";
import { Calculator, Info, Lock, Plus, SearchX, ShieldCheck, ShieldOff, UserCog, Users } from "lucide-react";
import {
  Card,
  CardHeader,
  Chip,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  IconTile,
  KpiStrip,
  Notice,
  Page,
  PageHeader,
  SegmentedControl,
  Sheet,
  StatCard,
  TextField,
  UserAvatar,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { thaiCopy } from "@/lib/thaiText";
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

/** Role as icon + word (patterns.md A2), not a coloured chip. */
function RoleCell({ role }: { role: StaffRole }) {
  const Icon = role === "ADMIN" ? ShieldCheck : Calculator;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {statusLabel("userRole", role)}
    </span>
  );
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The empty state's "ล้างตัวกรอง" disappears once it has worked: focus goes back to the search box.
  // (FilterBar's own button moves focus by itself.)
  const clearSearch = () => {
    setSearch("");
    window.requestAnimationFrame(() => toolbarRef.current?.querySelector<HTMLElement>('input[type="search"]')?.focus());
  };

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
      cell: (u) => {
        const name = u.displayName && u.displayName !== u.email ? u.displayName : (u.email ?? PLACEHOLDER);
        const secondary = `${u.email ?? PLACEHOLDER}${u.pendingRegistration ? ` · ${t("roles.pendingLogin")}` : ""}`;
        return (
          // Identity cell (A2): avatar 32 (a jade ring for "you") + name + email. data-identity-cell: in the
          // phone card the role line starts under the name, as under an IdentityCell (same avatar + gap).
          <span data-identity-cell="" className="flex min-w-0 items-center gap-2.5">
            <UserAvatar name={name} seed={u.userId} size="sm" self={u.isSelf} decorative />
            {/* The table caps name + email (full value in the title) so all five columns fit the card:
                176px up to 1280, 208px up to 1536, then 288px. Phones use the card's width. */}
            <span className="min-w-0 md:max-w-44 xl:max-w-52 2xl:max-w-72">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate leading-[1.45] font-medium text-fg" title={name}>
                  {name}
                </span>
                {u.isSelf ? (
                  <Chip tone="brand" size="sm">
                    {t("roles.you")}
                  </Chip>
                ) : null}
              </span>
              {/* data-card-empty: a lone "–" (no email) stays in the table but not in the phone card. */}
              <span
                data-card-empty={!u.email && !u.pendingRegistration ? "" : undefined}
                className="block truncate text-[0.8125rem] leading-[1.45] text-fg-muted"
                title={secondary}
              >
                {secondary}
              </span>
            </span>
          </span>
        );
      },
    },
    { key: "role", header: t("roles.colRole"), mobile: "secondary", cell: (u) => <RoleCell role={u.role} /> },
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
    {
      key: "createdAt",
      header: t("roles.colAddedAt"),
      cell: (u) => <span className="whitespace-nowrap tabular">{formatThaiDate(u.createdAt)}</span>,
    },
    {
      key: "actions",
      header: t("roles.colActions"),
      align: "right",
      // Phones: a full-width row at the bottom of the card, so every label stays on one line.
      mobile: "actions",
      cell: (u) => {
        if (u.isSelf || !u.email) {
          if (!u.isSelf) return <span className="text-[0.8125rem] text-fg-subtle">{PLACEHOLDER}</span>;
          return (
            // 768–1279 the actions column is one icon wide and this Thai note would break mid-word there:
            // a lock with the note as its accessible name and tooltip (the rules card below spells it out).
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-fg-subtle" title={t("roles.ruleNoSelf")}>
              <Lock aria-hidden="true" className="hidden size-4 shrink-0 md:max-xl:block" />
              <span className="md:max-xl:sr-only">{t("roles.ruleNoSelf")}</span>
            </span>
          );
        }
        const email = u.email;
        const locked = isLastActiveAdmin(u);
        const changeLabel = u.role === "ADMIN" ? t("roles.makeChecker") : t("roles.makeAdmin");
        // Same buttons at every width; only their shape changes so the five columns fit the card:
        // phones: labelled, wrapping onto a second line as whole buttons;
        // 768–1279: icon buttons (the label stays as the accessible name and the tooltip);
        // 1280–1439: labelled, stacked; from 1440: labelled, side by side.
        const shape = "md:max-xl:w-8 md:max-xl:px-0";
        const label = "md:max-xl:sr-only";
        return (
          <span className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end md:gap-1.5 xl:flex-col xl:items-end min-[90rem]:flex-row min-[90rem]:items-center">
            {u.isActive ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  title={changeLabel}
                  className={shape}
                  onClick={() => ask({ email, role: u.role === "ADMIN" ? "FINANCE_CHECKER" : "ADMIN", active: true, current: u })}
                >
                  <UserCog aria-hidden="true" />
                  <span className={label}>{changeLabel}</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={locked}
                  title={t("roles.revoke")}
                  className={shape}
                  onClick={() => ask({ email, role: u.role, active: false, current: u })}
                >
                  <ShieldOff aria-hidden="true" />
                  <span className={label}>{t("roles.revoke")}</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="soft"
                title={t("roles.restore")}
                className={shape}
                onClick={() => ask({ email, role: u.role, active: true, current: u })}
              >
                <ShieldCheck aria-hidden="true" />
                <span className={label}>{t("roles.restore")}</span>
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

      <KpiStrip columns={3}>
        <StatCard label={t("roles.statAdmins")} value={data ? formatNumber(activeAdmins) : "–"} icon={ShieldCheck} tone="brand" />
        <StatCard label={t("roles.statCheckers")} value={data ? formatNumber(activeCheckers) : "–"} icon={Calculator} tone="blue" />
        <StatCard label={t("roles.statRevoked")} value={data ? formatNumber(revoked) : "–"} icon={ShieldOff} tone="neutral" />
      </KpiStrip>

      {data && activeAdmins <= 1 ? <Notice tone="warning">{t("roles.lastAdminNotice")}</Notice> : null}

      <div ref={toolbarRef}>
        <FilterBar
          search={{ value: search, onValueChange: setSearch, placeholder: t("roles.searchPlaceholder") }}
          isFiltered={search !== ""}
          onReset={() => setSearch("")}
        />
      </div>

      {error && !data ? (
        <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />
      ) : (
        <DataTable
          caption={t("roles.tableCaption")}
          columns={columns}
          rows={rows}
          loading={isLoading}
          getRowKey={(u) => u.userId}
          empty={
            <EmptyState
              icon={search ? SearchX : Users}
              title={search ? t("users.emptyTitle") : t("roles.emptyStaff")}
              action={
                search ? (
                  <Button variant="outline" onClick={clearSearch}>
                    {t("shell.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      <Card>
        <CardHeader
          title={t("roles.rulesTitle")}
          icon={<IconTile icon={Info} tone="neutral" size="sm" />}
          className="mb-3 items-center"
        />
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-fg-muted marker:text-fg-subtle">
          <li>{thaiCopy(t("roles.ruleStaffOnly"))}</li>
          <li>{thaiCopy(t("roles.ruleNoSelf"))}</li>
          <li>{thaiCopy(t("roles.ruleLastAdmin"))}</li>
        </ul>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t("roles.addSheetTitle")}
        description={t("roles.addSheetDescription")}
        width={480}
        footer={
          <div className="flex w-full flex-col gap-2 md:flex-row md:justify-end">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
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
