"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { claimClass } from "./actions";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setErrorMessage(error.message || t("tutorClass.auction.claimFailed"));
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
      <Button
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
      >
        {loading ? t("tutorClass.auction.claiming") : t("tutorClass.auction.claim")}
      </Button>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการรับคลาสนี้?</DialogTitle>
            <DialogDescription>
              {t("tutorClass.auction.confirmClaim")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("tutorClass.detail.cancel")}
            </Button>
            <Button onClick={handleConfirm}>
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={handleSuccessClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สำเร็จ</DialogTitle>
            <DialogDescription>
              {t("tutorClass.auction.claimSuccess")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleSuccessClose}>ตกลง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เกิดข้อผิดพลาด</DialogTitle>
            <DialogDescription>{errorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
