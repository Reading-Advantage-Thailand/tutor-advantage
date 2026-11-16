"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight, Power, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import {
  AdminStatusChip,
  ConfirmDialog,
  DescriptionList,
  IconTile,
  ListRow,
  Notice,
  useHasRole,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, newIdempotencyKey } from "@/lib/api";
import { formatThaiDate, formatThaiDateTime, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import {
  FIELD_ICONS,
  displayName,
  fieldLabel,
  fieldStatusTone,
  invalidateUser,
  useUserDetail,
  visibleFields,
  type UserDetailV2,
} from "./model";
import { Panel } from "./components/Panel";
import "@/locales/th/userDetail";
import "@/locales/th/userHeader";

const PROVIDER_LABELS: Record<string, string> = { line: "LINE", google: "Google", LINE: "LINE", GOOGLE: "Google" };

/** One action in the danger zone: what it does on the left, its button on the right. */
function DangerRow({ icon: Icon, title, body, action }: { icon: typeof Power; title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 [&+&]:border-t [&+&]:border-hairline">
      <div className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-muted" />
        <div className="min-w-0">
          <p className="text-sm leading-[1.6] font-semibold text-fg">{keepThaiWords(title)}</p>
          <p className="mt-0.5 text-[0.8125rem] leading-[1.6] text-fg-muted">{thaiCopy(body)}</p>
        </div>
      </div>
      <div className="flex shrink-0 max-sm:pl-8">{action}</div>
    </div>
  );
}

/**
 * Danger zone (patterns.md A3): a separate card at the bottom with a danger
 * rim; each destructive button opens a ConfirmDialog with a reason field.
 */
function AccountActions({ user, adminId }: { user: UserDetailV2; adminId: string }) {
  const [dialog, setDialog] = useState<"suspend" | "anonymize" | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const refreshSummary = useRefreshAdminSummary();
  const name = displayName(user);
  const suspended = user.accountStatus === "SUSPENDED";
  const anonymized = user.accountStatus === "ANONYMIZED";
  const open = (next: "suspend" | "anonymize") => {
    setIdempotencyKey(newIdempotencyKey());
    setDialog(next);
  };

  const submitSuspend = async ({ reason }: { reason: string }) => {
    const response = await api.post<{ isActive: boolean }>(
      `/v1/users/${user.id}/suspend`,
      { isActive: suspended, reason },
      { idempotencyKey },
    );
    toast.success(response.isActive ? t("userDetail.reactivatedToast") : t("userDetail.suspendedToast"));
    invalidateUser(adminId, user.id);
  };

  const submitAnonymize = async ({ reason }: { reason: string }) => {
    const response = await api.post<{ alreadyAnonymized?: boolean; scrubbed?: unknown }>(
      `/v1/users/${user.id}/anonymize`,
      { reason },
      { idempotencyKey },
    );
    toast.success(response.alreadyAnonymized && !response.scrubbed ? t("userDetail.alreadyAnonymizedToast") : t("userDetail.anonymizedToast"));
    invalidateUser(adminId, user.id);
    refreshSummary();
  };

  // What the erasure removes, listed from what is actually on file.
  const removes = [
    t("userDetail.fullName"),
    user.email ? t("userDetail.email") : null,
    user.phone ? t("userDetail.phone") : null,
    user.dateOfBirth ? t("userDetail.dateOfBirth") : null,
    user.hasIdCardImage || user.hasBankBookImage ? t("userHeader.tabVerification") : null,
    user.settings.nationalId || user.settings.hasNationalId ? t("userDetail.nationalId") : null,
    user.settings.bankAccountNumber ? t("userDetail.bankAccountNumber") : null,
    user.settings.address || user.settings.hasAddress ? t("userHeader.deliveryAddress") : null,
    user.settings.omiseRecipientId ? t("userDetail.omiseTitle") : null,
    user.loginProviders.length ? t("userDetail.loginProviders") : null,
    user.guardians.length ? t("userDetail.guardianSection") : null,
  ].filter(Boolean);

  return (
    <Panel id="user-danger-zone" tone="danger" icon={<IconTile icon={AlertTriangle} tone="red" size="sm" />} title={t("userDetail.dangerZone")}>
      {!anonymized ? (
        <DangerRow
          icon={Power}
          title={suspended ? t("userDetail.reactivateTitle") : t("userDetail.suspendTitle")}
          body={t("userDetail.suspendBody")}
          action={
            <Button variant={suspended ? "soft" : "destructive"} onClick={() => open("suspend")}>
              {suspended ? t("userDetail.reactivateConfirm") : t("userDetail.suspendConfirm")}
            </Button>
          }
        />
      ) : null}
      <DangerRow
        icon={Trash2}
        title={t("userDetail.anonymizeAction")}
        body={t("userDetail.anonymizeBody")}
        action={
          <Button variant="destructive" onClick={() => open("anonymize")}>
            {t("userDetail.anonymizeAction")}
          </Button>
        }
      />

      <ConfirmDialog
        open={dialog === "suspend"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={
          suspended
            ? t("userDetail.reactivateConfirmTitle", { name })
            : t("userDetail.suspendConfirmTitle", { name })
        }
        description={t("userDetail.suspendBody")}
        confirmLabel={suspended ? t("userDetail.reactivateConfirm") : t("userDetail.suspendConfirm")}
        tone={suspended ? "brand" : "danger"}
        reason={{ label: t("userDetail.reasonLabel") }}
        onConfirm={submitSuspend}
      />

      <ConfirmDialog
        open={dialog === "anonymize"}
        onOpenChange={(next) => !next && setDialog(null)}
        title={t("userDetail.anonymizeConfirmTitle", { name })}
        description={t("userDetail.anonymizeBody")}
        confirmLabel={t("userDetail.anonymizeConfirm")}
        tone="danger"
        irreversible
        requireText={user.email ?? user.id}
        reason={{ label: t("userDetail.reasonLabel"), placeholder: t("userDetail.anonymizeReasonPlaceholder") }}
        details={
          <DescriptionList
            columns={1}
            items={[
              { label: t("userDetail.anonymizeWillRemove"), value: removes.join(" · ") || PLACEHOLDER },
              { label: t("userDetail.anonymizeWillKeep"), value: keepThaiWords(t("userDetail.anonymizeKeepList")) },
            ]}
          />
        }
        onConfirm={submitAnonymize}
      />
    </Panel>
  );
}

/** Right rail for tutors: each identity document's status and when it last moved (the status timeline). */
function VerificationStatusCard({ user }: { user: UserDetailV2 }) {
  return (
    <Panel
      id="user-verification-status"
      title={t("userHeader.tabVerification")}
      action={
        <Link href={`/users/${user.id}/verification`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {t("shell.viewAll")}
          <ChevronRight aria-hidden="true" />
        </Link>
      }
    >
      <ul>
        {visibleFields(user).map((field) => {
          const item = user.settings.verification?.[field];
          const status = item?.status ?? "UNVERIFIED";
          const when = item?.reviewedAt
            ? t("userDetail.fieldReviewedAt", { date: formatThaiDateTime(item.reviewedAt) })
            : item?.updatedAt && status !== "UNVERIFIED"
              ? t("userDetail.fieldSubmittedAt", { date: formatThaiDateTime(item.updatedAt) })
              : t("userDetail.fieldNotSubmitted");
          return (
            <li key={field} className="flex items-start gap-3 px-4 py-3 [&+&]:border-t [&+&]:border-hairline">
              <IconTile icon={FIELD_ICONS[field]} tone={fieldStatusTone(status)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-[1.6] font-medium text-fg">{keepThaiWords(fieldLabel(field, user))}</p>
                <p className="text-[0.8125rem] leading-[1.6] text-fg-muted">{thaiCopy(when)}</p>
              </div>
              <AdminStatusChip domain="verification" status={status} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Right rail for students: who gave consent as the guardian. */
function GuardianCard({ user }: { user: UserDetailV2 }) {
  return (
    <Panel id="user-guardians" title={t("userDetail.guardianSection")}>
      {user.guardians.length ? (
        user.guardians.map((guardian) => (
          <ListRow
            key={guardian.id}
            leading={<IconTile icon={ShieldCheck} tone="teal" size="sm" />}
            title={guardian.name ?? t("userDetail.hiddenValue")}
            subtitle={`${t("userDetail.guardianRelation")}: ${guardian.relation}`}
            meta={<span className="text-[0.8125rem] text-fg-muted tabular">{`${t("userDetail.consentedAt")} ${formatThaiDateTime(guardian.consentedAt)}`}</span>}
          />
        ))
      ) : (
        <div className="p-3">
          <Notice tone="warning" icon={UserRoundX}>
            {t("userDetail.guardianNone")}
          </Notice>
        </div>
      )}
    </Panel>
  );
}

export default function UserProfileTab() {
  const { data: user, me } = useUserDetail();
  const isAdmin = useHasRole("ADMIN");
  if (!user || !me) return null;

  const contact = [
    { label: t("userDetail.email"), value: <span className="break-all">{user.email ?? t("userHeader.noEmail")}</span> },
    { label: t("userDetail.phone"), value: <span className="tabular">{user.phone ?? PLACEHOLDER}</span> },
    ...(isAdmin ? [{ label: t("userDetail.dateOfBirth"), value: formatThaiDate(user.dateOfBirth) || PLACEHOLDER }] : []),
    { label: t("userDetail.joinedAt"), value: <span className="tabular">{formatThaiDateTime(user.joinedAt)}</span> },
    {
      label: t("userDetail.loginProviders"),
      value: user.loginProviders.length
        ? user.loginProviders.map((provider) => PROVIDER_LABELS[provider] ?? provider).join(", ")
        : t("userDetail.noLoginProvider"),
    },
    ...(user.role === "TUTOR"
      ? [
          {
            label: t("userDetail.sponsor"),
            value: user.sponsor ? (
              <Link className="text-brand-fg hover:underline" href={`/users/${user.sponsor.id}`}>
                {user.sponsor.name || t("userHeader.unnamed")}
              </Link>
            ) : (
              t("userDetail.noSponsor")
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Two columns from 1280: facts on the left, the status rail on the right (patterns.md A3). */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel id="user-contact" title={t("userDetail.contactSection")} bodyClassName="p-4 md:p-5">
            <DescriptionList items={contact} />
          </Panel>

          <Panel id="user-consents" title={t("userDetail.consentSection")}>
            {user.consentLogs.length ? (
              user.consentLogs.map((log) => (
                <ListRow
                  key={log.id}
                  // Consent types are long SNAKE_CASE ids: let them wrap anywhere rather than clip.
                  title={<span className="break-all">{log.type}</span>}
                  subtitle={t("userDetail.consentVersion", { version: formatThaiDate(log.version) })}
                  meta={<span className="text-[0.8125rem] text-fg-muted tabular">{formatThaiDateTime(log.timestamp)}</span>}
                  trailing={<span className="text-[0.8125rem] text-fg-muted">{log.status}</span>}
                />
              ))
            ) : (
              <p className="px-4 py-4 text-sm text-fg-muted">{t("userDetail.consentNone")}</p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {user.role === "TUTOR" ? <VerificationStatusCard user={user} /> : null}
          {user.role === "STUDENT" ? <GuardianCard user={user} /> : null}
        </div>
      </div>

      {isAdmin ? <AccountActions user={user} adminId={me.userId} /> : null}
    </>
  );
}
