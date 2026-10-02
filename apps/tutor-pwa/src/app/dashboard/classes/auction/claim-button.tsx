"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, Sheet } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { claimClass } from "./actions";

export function ClaimButton({ transferId }: { transferId: string }) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      await claimClass(transferId);
      setSuccessOpen(true);
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message ? error.message : t("tutorClass.auction.claimFailed"));
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    router.push("/dashboard/classes");
  };

  return (
    <>
      <Button className="w-full md:w-auto" onClick={() => setConfirmOpen(true)} loading={loading}>
        {loading ? t("tutorClass.auction.claiming") : t("tutorClass.auction.claim")}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("tutorClass.ui.claimConfirmTitle")}
        description={t("tutorClass.auction.confirmClaim")}
        confirmLabel={t("shell.confirm")}
        cancelLabel={t("tutorClass.detail.cancel")}
        onConfirm={handleConfirm}
      />

      <Sheet
        open={successOpen}
        onOpenChange={(open) => {
          if (!open) handleSuccessClose();
        }}
        title={t("tutorClass.ui.claimSuccessTitle")}
        description={t("tutorClass.auction.claimSuccess")}
        width={440}
        bodyClassName="hidden"
        footer={
          <div className="flex md:justify-end">
            <Button size="lg" className="w-full md:h-9 md:w-auto" onClick={handleSuccessClose}>
              {t("tutorClass.ui.goToClasses")}
            </Button>
          </div>
        }
      />

      <Sheet
        open={errorOpen}
        onOpenChange={setErrorOpen}
        title={t("shell.errorTitle")}
        description={errorMessage}
        width={440}
        bodyClassName="hidden"
        footer={
          <div className="flex md:justify-end">
            <Button variant="outline" size="lg" className="w-full md:h-9 md:w-auto" onClick={() => setErrorOpen(false)}>
              {t("shell.close")}
            </Button>
          </div>
        }
      />
    </>
  );
}
