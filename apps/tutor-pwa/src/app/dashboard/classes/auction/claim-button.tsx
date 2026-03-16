"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { claimClass } from "./actions";
import { useRouter } from "next/navigation";

export function ClaimButton({ transferId }: { transferId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClaim = async () => {
    if (!confirm("คุณรบบยึดว่าต้องการรับช่วงคลาสนี้ต่อใช่หรือไม่?")) return;
    
    setLoading(true);
    try {
      await claimClass(transferId);
      alert("รับช่วงหลาสสำเร็จ!");
      router.push("/dashboard/classes");
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      alert(error.message || "เกิดข้อผิดพลาดในการรับช่วงคลาส");
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
      {loading ? "กำลังรับช่วง..." : "รับช่วงต่อคลาสนี้"}
    </Button>
  );
}
