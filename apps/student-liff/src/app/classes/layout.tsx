import { BottomNav } from "@/components/layout/BottomNav";

export const metadata = { title: "คลาสเรียน — Tutor Advantage" };

export default function ClassesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
}
