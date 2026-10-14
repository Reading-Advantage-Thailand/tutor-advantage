"use client";

import Link from "next/link";
import { useState } from "react";
import { Power, ShieldCheck, Trash2 } from "lucide-react";
import {
  Card,
  CardHeader,
  ConfirmDialog,
  DescriptionList,
  ListGroup,
  ListRow,
  Section,
  useHasRole,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { Button } from "@/components/ui/button";
import { api, newIdempotencyKey } from "@/lib/api";
import { formatThaiDate, formatThaiDateTime, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { displayName, invalidateUser, useUserDetail, type UserDetailV2 } from "./model";
import "@/locales/th/userDetail";
import "@/locales/th/userHeader";

const PROVIDER_LABELS: Record<string, string> = { line: "LINE", google: "Google", LINE: "LINE", GOOGLE: "Google" };

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
    <Section title={t("userDetail.dangerZone")}>
      <ListGroup>
        {!anonymized ? (
          <ListRow
            leading={<Power aria-hidden="true" className="size-5 text-fg-muted" />}
            title={suspended ? t("userDetail.reactivateTitle") : t("userDetail.suspendTitle")}
            subtitle={t("userDetail.suspendBody")}
            trailing={
              <Button size="sm" variant={suspended ? "soft" : "outline"} onClick={() => open("suspend")}>
                {suspended ? t("userDetail.reactivateConfirm") : t("userDetail.suspendConfirm")}
              </Button>
            }
          />
        ) : null}
        <ListRow
          leading={<Trash2 aria-hidden="true" className="size-5 text-danger-fg" />}
          title={t("userDetail.anonymizeAction")}
          subtitle={t("userDetail.anonymizeBody")}
          lines={2}
          trailing={
            <Button size="sm" variant="destructive" onClick={() => open("anonymize")}>
              {t("userDetail.anonymizeAction")}
            </Button>
          }
        />
      </ListGroup>

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
              { label: t("userDetail.anonymizeWillKeep"), value: t("userDetail.anonymizeKeepList") },
            ]}
          />
        }
        onConfirm={submitAnonymize}
      />
    </Section>
  );
}

export default function UserProfileTab() {
  const { data: user, me } = useUserDetail();
  const isAdmin = useHasRole("ADMIN");
  if (!user || !me) return null;

  const contact = [
    { label: t("userDetail.email"), value: user.email ?? t("userHeader.noEmail") },
    { label: t("userDetail.phone"), value: user.phone ?? PLACEHOLDER },
    ...(isAdmin ? [{ label: t("userDetail.dateOfBirth"), value: formatThaiDate(user.dateOfBirth) }] : []),
    { label: t("userDetail.joinedAt"), value: formatThaiDateTime(user.joinedAt) },
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
      <Card>
        <CardHeader title={t("userDetail.contactSection")} />
        <DescriptionList items={contact} />
      </Card>

      {user.role === "STUDENT" ? (
        <Section title={t("userDetail.guardianSection")}>
          {user.guardians.length ? (
            <ListGroup>
              {user.guardians.map((guardian) => (
                <ListRow
                  key={guardian.id}
                  leading={<ShieldCheck aria-hidden="true" className="size-5 text-success-fg" />}
                  title={guardian.name ?? t("userDetail.hiddenValue")}
                  subtitle={`${t("userDetail.guardianRelation")}: ${guardian.relation}`}
                  meta={`${t("userDetail.consentedAt")} ${formatThaiDateTime(guardian.consentedAt)}`}
                />
              ))}
            </ListGroup>
          ) : (
            <Card tone="warning" padding="md">
              <p className="text-sm text-warning-fg">{t("userDetail.guardianNone")}</p>
            </Card>
          )}
        </Section>
      ) : null}

      <Section title={t("userDetail.consentSection")}>
        {user.consentLogs.length ? (
          <ListGroup>
            {user.consentLogs.map((log) => (
              <ListRow
                key={log.id}
                title={log.type}
                subtitle={t("userDetail.consentVersion", { version: formatThaiDate(log.version) })}
                meta={formatThaiDateTime(log.timestamp)}
                trailing={<span className="text-[0.8125rem] text-fg-muted">{log.status}</span>}
              />
            ))}
          </ListGroup>
        ) : (
          <p className="text-sm text-fg-muted">{t("userDetail.consentNone")}</p>
        )}
      </Section>

      {isAdmin ? <AccountActions user={user} adminId={me.userId} /> : null}
    </>
  );
}
