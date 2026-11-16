import { t } from "@/lib/i18n";

export const metadata = {
  title: t("app.dashboardTitle"),
};

// The bottom TabBar is rendered once by the root layout. `.page-content` adds
// the tablet gutter from 640px; the home hero still runs edge to edge of the
// app column (globals.css breaks it out of the gutter).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
    </div>
  );
}
