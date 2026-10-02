"use client";

import type { ReactNode } from "react";
import { UserX } from "lucide-react";
import {
  AdminStatusChip,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  IdCell,
  Notice,
  Page,
  PageHeader,
  PageHeaderSkeleton,
  TabNav,
  UserAvatar,
  useHasRole,
} from "@/components/app";
import { ApiError } from "@/lib/api";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { displayName, pendingFields, useUserDetail } from "./model";
import "@/locales/th/userHeader";

export default function UserDetailLayout({ children }: { children: ReactNode }) {
  const { data: user, error, refetch, userId } = useUserDetail();
  const isAdmin = useHasRole("ADMIN");
  const base = `/users/${userId}`;

  if (error && !user) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <Page width="medium">
        <PageHeader title={t("userHeader.loadError")} backHref="/users" backLabel={t("userHeader.backToList")} />
        {notFound ? (
          <EmptyState icon={UserX} title={t("userHeader.userNotFound")} />
        ) : (
          <ErrorState onRetry={refetch} />
        )}
      </Page>
    );
  }

  if (!user) {
    return (
      <Page width="medium">
        <PageHeaderSkeleton actions={false} />
        <CardSkeleton lines={6} />
      </Page>
    );
  }

  const pending = pendingFields(user).length;
  const tabs = [
    { href: base, label: t("userHeader.tabProfile") },
    ...(user.role === "TUTOR"
      ? [{ href: `${base}/verification`, label: t("userHeader.tabVerification"), count: pending || undefined }]
      : []),
    { href: `${base}/classes`, label: t("userHeader.tabClasses"), count: user.classes.length },
    { href: `${base}/payments`, label: t("userHeader.tabPayments") },
    ...(isAdmin ? [{ href: `${base}/audit`, label: t("userHeader.tabAudit") }] : []),
  ];

  return (
    <Page width="medium">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <UserAvatar name={user.name ?? ""} src={user.profilePictureUrl} size="md" />
            <span className="min-w-0 truncate">{displayName(user)}</span>
          </span>
        }
        appBarTitle={displayName(user)}
        mobileTitle="inline"
        description={user.email ?? t("userHeader.noEmail")}
        backHref="/users"
        backLabel={t("userHeader.backToList")}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <AdminStatusChip domain="userRole" status={user.role} />
            <AdminStatusChip domain="account" status={user.accountStatus} />
            {user.role === "TUTOR" ? <AdminStatusChip domain="verification" status={user.verificationStatus} /> : null}
            {pending > 0 ? (
              <Chip tone="warning" size="sm">
                {t("userHeader.pendingCount", { count: pending })}
              </Chip>
            ) : null}
            <IdCell id={user.id} label={t("userHeader.userId")} />
          </span>
        }
      />

      {user.accountStatus === "ANONYMIZED" ? (
        <Notice tone="neutral">
          {t("userHeader.anonymizedNotice", { date: formatThaiDate(user.anonymizedAt) })}
        </Notice>
      ) : null}
      {user.piiMasked ? <Notice tone="info">{t("userHeader.piiMaskedNotice")}</Notice> : null}

      <TabNav items={tabs} aria-label={t("userHeader.tabsLabel")} />
      {children}
    </Page>
  );
}
