"use client";

import Link from "next/link";
import { ChevronLeft, FileSearch, GraduationCap, Presentation, UserRound } from "lucide-react";
import { AdminStatusChip, Chip, IdCell, ShellTitle, UserAvatar } from "@/components/app";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { displayName, type UserDetailV2 } from "../model";
import "@/locales/th/userHeader";
import "@/locales/th/users";

/**
 * Record header for a user (patterns.md A3): avatar 56, the name as the page
 * h1, contact + copyable user id, status chips (colour + dot + word) and the
 * primary action for the record's state on the right. Registers the phone
 * app-bar title and back target like <PageHeader>.
 */
export function UserRecordHeader({
  user,
  pending,
  reviewHref,
}: {
  user: UserDetailV2;
  /** Verification fields waiting for review. */
  pending: number;
  /** Set when the record's next step is reviewing documents (not on that tab already). */
  reviewHref?: string;
}) {
  const name = displayName(user);
  const RoleIcon = user.role === "TUTOR" ? Presentation : user.role === "STUDENT" ? GraduationCap : UserRound;
  const email = user.email ?? t("userHeader.noEmail");

  return (
    <header className="flex flex-col gap-3">
      <ShellTitle title={name} backHref="/users" />
      <Link
        href="/users"
        className="hidden min-h-9 items-center gap-1 self-start rounded-(--radius-ctl-sm) text-sm font-medium text-fg-muted hover:text-fg md:inline-flex pointer-coarse:min-h-11"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {t("userHeader.backToList")}
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex min-w-0 items-start gap-4">
          {/* The name is the heading; the avatar repeats it. */}
          <span aria-hidden="true" className="shrink-0">
            <UserAvatar name={user.name} src={user.profilePictureUrl} seed={user.id} size="lg" className="max-md:size-12 max-md:text-base" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-[1.4] font-semibold break-words text-fg text-balance-th md:text-2xl md:leading-[1.35]">
              {name}
            </h1>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              <span className="min-w-0 max-w-full truncate" title={email}>
                {email}
              </span>
              <IdCell id={user.id} label={t("userHeader.userId")} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted">
                <RoleIcon aria-hidden="true" className="size-4" />
                {statusLabel("userRole", user.role)}
              </span>
              <AdminStatusChip domain="account" status={user.accountStatus} size="md" />
              {user.role === "TUTOR" ? <AdminStatusChip domain="verification" status={user.verificationStatus} size="md" /> : null}
              {pending > 0 ? (
                <Chip tone="warning">{t("userHeader.pendingCount", { count: pending })}</Chip>
              ) : null}
            </div>
          </div>
        </div>
        {reviewHref ? (
          <Link href={reviewHref} className={buttonVariants({ className: "self-start max-lg:w-full sm:max-lg:w-auto" })}>
            <FileSearch aria-hidden="true" />
            {t("users.reviewDocuments")}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
