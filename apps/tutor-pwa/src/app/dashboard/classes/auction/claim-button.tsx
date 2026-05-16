"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { claimClass } from "./actions";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

export function ClaimButton({ transferId }: { transferId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClaim = async () => {
    if (!confirm(t("tutorClass.auction.confirmClaim"))) return;
    
    setLoading(true);
    try {
      await claimClass(transferId);
      alert(t("tutorClass.auction.claimSuccess"));
      router.push("/dashboard/classes");
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      alert(error.message || t("tutorClass.auction.claimFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      size="sm" 
      className="w-full sm:w-auto" 
      onClick={handleClaim} 
      disabled={loading}
    >
      {loading ? t("tutorClass.auction.claiming") : t("tutorClass.auction.claim")}
    </Button>
  );
}
