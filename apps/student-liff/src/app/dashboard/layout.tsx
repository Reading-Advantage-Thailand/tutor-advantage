import { t } from "@/lib/i18n";

export const metadata = {
  title: t("app.dashboardTitle"),
};

// The bottom TabBar is rendered once by the root layout.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
    </div>
  );
}
