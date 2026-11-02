"use client";

import { UsersRound } from "lucide-react";
import {
  AdminStatusChip,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  ListSkeleton,
  Sheet,
  useAdminSession,
} from "@/components/app";
import { api, errorMessage } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatSatang, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { redemptionPhone, type DiscountCode, type DiscountCodeRedemption } from "../discountCodeForm";
import "@/locales/th/discountCodes";

export interface RedemptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The code whose students to list (kept while the sheet animates closed). */
  code: DiscountCode | null;
}

/** Students who used a discount code (GET /v1/discount-codes/:id/redemptions), newest first. */
export function RedemptionsSheet({ open, onOpenChange, code }: RedemptionsSheetProps) {
  const me = useAdminSession();
  const { data, error, isLoading, refetch } = useCachedResource(
    me && code ? `${me.userId}:discount-codes:redemptions:${code.discountCodeId}` : null,
    () => api.get<{ items: DiscountCodeRedemption[] }>(`/v1/discount-codes/${code?.discountCodeId}/redemptions`),
    { enabled: open },
  );
  const items = data?.items ?? [];

  let body: React.ReactNode;
  if (error && !data) {
    body = <ErrorState compact description={errorMessage(error)} onRetry={refetch} />;
  } else if (isLoading || !data) {
    body = <ListSkeleton rows={3} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        compact
        icon={UsersRound}
        title={t("discountCodes.redemptionsEmpty")}
        description={t("discountCodes.redemptionsEmptyHint")}
      />
    );
  } else {
    body = (
      <ListGroup aria-label={code ? t("discountCodes.redemptionsTitle", { code: code.code }) : undefined}>
        {items.map((item) => (
          <ListRow
            key={item.redemptionId}
            href={`/users/${encodeURIComponent(item.studentUserId)}`}
            title={item.studentName || t("discountCodes.studentUnnamed")}
            subtitle={[
              item.studentEmail,
              redemptionPhone(item, code),
              t("discountCodes.redeemedOn", { date: formatThaiDateTime(item.createdAt) }),
            ]
              .filter(Boolean)
              .join(" · ")}
            meta={
              <>
                {item.enrollmentStatus ? <AdminStatusChip domain="enrollment" status={item.enrollmentStatus} /> : null}
                <span className="text-[0.8125rem] text-fg-muted">
                  {t("discountCodes.discountValue", { amount: formatSatang(item.originalAmountSatang) })}
                </span>
              </>
            }
          />
        ))}
      </ListGroup>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={code ? t("discountCodes.redemptionsTitle", { code: code.code }) : ""}
      description={
        code
          ? t("discountCodes.redemptionsDescription", {
              used: formatNumber(code.redeemedCount),
              max: formatNumber(code.maxRedemptions),
              title: code.classTitle ?? t("discountCodes.classUnknown"),
            })
          : undefined
      }
    >
      {body}
    </Sheet>
  );
}
