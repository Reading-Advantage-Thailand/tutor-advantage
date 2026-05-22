import { BottomNav } from "@/components/layout/BottomNav";
import { t } from "@/lib/i18n";

export const metadata = { title: t("app.profileTitle") };

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
}
