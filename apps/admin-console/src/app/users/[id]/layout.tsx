"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { UserX } from "lucide-react";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  LoadingAnnouncement,
  Notice,
  Page,
  PageHeader,
  Skeleton,
  TabNav,
  useHasRole,
} from "@/components/app";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { UserRecordHeader } from "./components/UserRecordHeader";
import { pendingFields, useUserDetail } from "./model";
import "@/locales/th/userHeader";

/** Mirrors the record header + tabs while the user loads. */
function UserHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <Skeleton className="size-12 shrink-0 rounded-full md:size-14" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="mt-1 flex gap-1.5">
            <Skeleton className="h-6 w-16 rounded-(--radius-chip)" />
            <Skeleton className="h-6 w-20 rounded-(--radius-chip)" />
            <Skeleton className="h-6 w-24 rounded-(--radius-chip)" />
          </div>
        </div>
      </div>
      <div className="flex gap-5 border-b border-hairline pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="hidden h-4 w-24 sm:block" />
      </div>
    </div>
  );
}

export default function UserDetailLayout({ children }: { children: ReactNode }) {
  const { data: user, error, refetch, userId } = useUserDetail();
  const isAdmin = useHasRole("ADMIN");
  const pathname = usePathname() ?? "";
  const base = `/users/${userId}`;

  if (error && !user) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <Page>
        <PageHeader title={t("userHeader.loadError")} backHref="/users" backLabel={t("userHeader.backToList")} />
        {notFound ? (
          <EmptyState
            icon={UserX}
            tone="amber"
            title={t("userHeader.userNotFound")}
            action={
              <Link href="/users" className={buttonVariants({ variant: "outline" })}>
                {t("userHeader.backToList")}
              </Link>
            }
          />
        ) : (
          <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />
        )}
      </Page>
    );
  }

  if (!user) {
    return (
      <Page>
        <LoadingAnnouncement />
        <UserHeaderSkeleton />
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
  // The record's next step: review the documents, unless that tab is already open.
  const reviewHref =
    user.role === "TUTOR" && pending > 0 && pathname !== `${base}/verification` ? `${base}/verification` : undefined;

  return (
    <Page>
      <UserRecordHeader user={user} pending={pending} reviewHref={reviewHref} />

      {user.accountStatus === "ANONYMIZED" ? (
        <Notice tone="neutral">
          {t("userHeader.anonymizedNotice", { date: formatThaiDate(user.anonymizedAt) })}
        </Notice>
      ) : null}
      {user.piiMasked ? <Notice tone="info">{t("userHeader.piiMaskedNotice")}</Notice> : null}

      <TabNav items={tabs} aria-label={t("userHeader.tabsLabel")} />
      {/* Next passes route `children` as a React.lazy node; next to its siblings React 19 dev
          warns "unique key" for it. A keyed Fragment makes it a single, validated child. */}
      <Fragment key="route">{children}</Fragment>
    </Page>
  );
}
