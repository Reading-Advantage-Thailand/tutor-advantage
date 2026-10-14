"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { BottomSheet, IconTile, ListGroup, ListRow, Notice } from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildPaymentHref, getEnrollmentKey, type Enrollment } from "@/lib/enrollmentStatus";
import { formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";

function describeEnrollment(enrollment: Enrollment): string {
  const parts = [enrollment.tutorName];
  if (enrollment.price != null) parts.push(formatTHB(enrollment.price));
  return parts.filter(Boolean).join(" · ");
}

/**
 * The single place Home shows unpaid enrollments: one amber notice with one
 * "ชำระเงิน" button. One class → straight to `/payment?classId=…&cycleId=…`;
 * several → a sheet to pick which one to pay.
 */
export function PendingPaymentNotice({ pending }: { pending: Enrollment[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  if (pending.length === 0) return null;

  const single = pending.length === 1 ? pending[0] : null;
  const description = single ? (
    <>
      <span className="block">{t("dashboard.pendingPaymentSub")}</span>
      <span className="mt-1 block font-semibold text-fg">
        {single.name}
        {single.price != null ? ` · ${formatTHB(single.price)}` : ""}
      </span>
    </>
  ) : (
    <>
      <span className="block">{t("dashboard.pendingPaymentSub")}</span>
      <span className="mt-1 block font-semibold text-fg">
        {pending.length} {t("dashboard.pendingPaymentCount")}
      </span>
    </>
  );

  return (
    <>
      <Notice
        tone="warning"
        role="status"
        title={t("dashboard.pendingPaymentTitle")}
        description={description}
        action={
          single ? (
            <Link href={buildPaymentHref(single)} className={buttonVariants({ variant: "warning", size: "touch" })}>
              <CreditCard aria-hidden="true" />
              {t("dashboard.pendingPaymentCta")}
            </Link>
          ) : (
            <Button variant="warning" size="touch" onClick={() => setPickerOpen(true)}>
              <CreditCard aria-hidden="true" />
              {t("dashboard.pendingPaymentCta")}
            </Button>
          )
        }
      />
      {single ? null : (
        <BottomSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title={t("dashboard.pendingPickerTitle")}
          description={t("dashboard.pendingPickerSubtitle")}
        >
          <ListGroup>
            {pending.map((enrollment, index) => (
              <ListRow
                key={getEnrollmentKey(enrollment, index)}
                href={buildPaymentHref(enrollment)}
                leading={<IconTile icon={CreditCard} tone="amber" />}
                title={enrollment.name}
                subtitle={describeEnrollment(enrollment)}
              />
            ))}
          </ListGroup>
        </BottomSheet>
      )}
    </>
  );
}
