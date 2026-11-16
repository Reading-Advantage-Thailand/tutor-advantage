import { t } from "@/lib/i18n";

export const metadata = { title: t("app.profileTitle") };

// The bottom TabBar is rendered once by the root layout. `.page-content` adds
// the tablet gutter from 640px, as on Home; the profile hero still runs edge
// to edge of the app column (globals.css breaks it out).
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
    </div>
  );
}
