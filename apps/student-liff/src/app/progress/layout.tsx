import { t } from "@/lib/i18n";

export const metadata = { title: t("app.progressTitle") };

// The bottom TabBar is rendered once by the root layout.
//
// `.page-content` adds the tablet gutter from 640px; the hero header still
// runs edge to edge of the app column (globals.css breaks it out).
export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
    </div>
  );
}
