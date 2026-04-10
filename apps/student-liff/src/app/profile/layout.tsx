import { BottomNav } from "@/components/layout/BottomNav";

export const metadata = { title: "โปรไฟล์ — Tutor Advantage" };

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
}
