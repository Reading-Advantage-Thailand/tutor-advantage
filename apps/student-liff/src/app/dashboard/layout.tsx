import { BottomNav } from "@/components/layout/BottomNav";

export const metadata = {
  title: "หน้าหลัก — Tutor Advantage",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
}
