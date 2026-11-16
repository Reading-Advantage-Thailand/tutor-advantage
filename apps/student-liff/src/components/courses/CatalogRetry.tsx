"use client";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "ลองใหม่" for the public catalogue's load errors: re-runs the server fetch (router.refresh). */
export function CatalogRetry({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Button type="button" variant="brand" size="touch" onClick={() => router.refresh()} className={className}>
      <RotateCw aria-hidden="true" />
      ลองใหม่
    </Button>
  );
}
