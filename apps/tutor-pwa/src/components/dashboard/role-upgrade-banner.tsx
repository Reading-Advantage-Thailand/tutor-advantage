"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X, ShieldCheck } from "lucide-react";

export function RoleUpgradeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("role_upgraded") === "true") {
      setVisible(true);
      // Remove query param from URL without reload
      const params = new URLSearchParams(searchParams.toString());
      params.delete("role_upgraded");
      const newUrl = params.size > 0 ? `${pathname}?${params}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
      <ShieldCheck className="h-5 w-5 shrink-0" />
      <span className="flex-1">บัญชีของคุณได้รับการอัปเกรดเป็น Tutor แล้ว</span>
      <button onClick={() => setVisible(false)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
