import { BottomNav } from "@/components/layout/BottomNav";
import { t } from "@/lib/i18n";

export const metadata = { title: t("app.progressTitle") };

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
}
