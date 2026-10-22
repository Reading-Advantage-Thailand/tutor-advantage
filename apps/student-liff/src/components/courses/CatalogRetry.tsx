"use client";
import { useRouter } from "next/navigation";

export function CatalogRetry() {
  const router = useRouter();
  return <button type="button" onClick={() => router.refresh()} className="mt-3 min-h-11 rounded-xl bg-brand-solid px-5 font-semibold text-white">ลองใหม่</button>;
}
