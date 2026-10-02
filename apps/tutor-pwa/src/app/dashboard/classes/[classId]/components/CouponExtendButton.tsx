"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { Sheet, TextField, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { applyCoupon } from "../../actions";

/** "ใส่คูปอง" button + sheet that adds free teaching hours to the class. */
export function CouponExtendButton({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await applyCoupon(classId, code.trim());
      setOpen(false);
      setCode("");
      toast.success(t("tutorClass.detail.couponSuccess"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("tutorClass.errors.coupon"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Ticket aria-hidden="true" />
        {t("tutorClass.ui.couponButton")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError("");
        }}
        title={t("tutorClass.detail.couponTitle")}
        description={t("tutorClass.detail.couponDescription")}
        dismissible={!loading}
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" size="lg" className="md:h-9" onClick={() => setOpen(false)} disabled={loading}>
              {t("tutorClass.detail.cancel")}
            </Button>
            <Button size="lg" className="md:h-9" onClick={handleApply} loading={loading} disabled={!code.trim()}>
              {loading ? t("tutorClass.detail.couponApplying") : t("tutorClass.detail.couponApply")}
            </Button>
          </div>
        }
      >
        <TextField
          id="extend-coupon"
          label={t("tutorClass.detail.couponLabel")}
          placeholder={t("tutorClass.detail.couponPlaceholder")}
          className="font-mono uppercase"
          autoCapitalize="characters"
          value={code}
          error={error || undefined}
          onChange={(event) => {
            setCode(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleApply();
            }
          }}
        />
      </Sheet>
    </>
  );
}
