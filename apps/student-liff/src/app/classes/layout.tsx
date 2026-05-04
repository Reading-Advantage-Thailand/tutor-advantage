"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { usePathname } from "next/navigation";

export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Only show BottomNav on the main classes list page, not on details [id]
  const isDetailPage = pathname.split("/").length > 2;

  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      {!isDetailPage && <BottomNav />}
    </div>
  );
}
