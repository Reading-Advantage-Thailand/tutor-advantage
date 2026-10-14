"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import { Notice } from "@/components/app/Feedback";
import { t } from "@/lib/i18n";

/** One-time success notice after ?role_upgraded=true (removes the param). */
export function RoleUpgradeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("role_upgraded") === "true") {
      setVisible(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("role_upgraded");
      const newUrl = params.size > 0 ? `${pathname}?${params}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);

  if (!visible) return null;

  return (
    <Notice
      tone="success"
      icon={ShieldCheck}
      role="status"
      action={
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={t("shell.close")}
          className="inline-flex size-7 items-center justify-center rounded-md opacity-70 hover:opacity-100"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      }
    >
      บัญชีของคุณได้รับการอัปเกรดเป็น Tutor แล้ว
    </Notice>
  );
}
