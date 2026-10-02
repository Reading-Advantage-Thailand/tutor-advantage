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

export default function UserDetailLayout({ children }: { children: ReactNode }) {
  const { data: user, error, refetch, userId } = useUserDetail();
  const isAdmin = useHasRole("ADMIN");
  const base = `/users/${userId}`;

  if (error && !user) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <Page width="medium">
        <PageHeader title={t("userDetail.loadError")} backHref="/users" backLabel={t("userDetail.backToList")} />
        {notFound ? (
          <EmptyState icon={UserX} title={t("userDetail.userNotFound")} />
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
    { href: base, label: t("userDetail.tabProfile") },
    ...(user.role === "TUTOR"
      ? [{ href: `${base}/verification`, label: t("userDetail.tabVerification"), count: pending || undefined }]
      : []),
    { href: `${base}/classes`, label: t("userDetail.tabClasses"), count: user.classes.length },
    { href: `${base}/payments`, label: t("userDetail.tabPayments") },
    ...(isAdmin ? [{ href: `${base}/audit`, label: t("userDetail.tabAudit") }] : []),
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
        description={user.email ?? t("userDetail.noEmail")}
        backHref="/users"
        backLabel={t("userDetail.backToList")}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <AdminStatusChip domain="userRole" status={user.role} />
            <AdminStatusChip domain="account" status={user.accountStatus} />
            {user.role === "TUTOR" ? <AdminStatusChip domain="verification" status={user.verificationStatus} /> : null}
            {pending > 0 ? (
              <Chip tone="warning" size="sm">
                {t("userDetail.pendingCount", { count: pending })}
              </Chip>
            ) : null}
            <IdCell id={user.id} label={t("userDetail.userId")} />
          </span>
        }
      />

      {user.accountStatus === "ANONYMIZED" ? (
        <Notice tone="neutral">
          {t("userDetail.anonymizedNotice", { date: formatThaiDate(user.anonymizedAt) })}
        </Notice>
      ) : null}
      {user.piiMasked ? <Notice tone="info">{t("userDetail.piiMaskedNotice")}</Notice> : null}

      <TabNav items={tabs} aria-label={t("userDetail.tabsLabel")} />
      {children}
    </Page>
  );
}
