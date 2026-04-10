import { BottomNav } from "@/components/layout/BottomNav";

export const metadata = { title: "ความก้าวหน้า — Tutor Advantage" };

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
}
