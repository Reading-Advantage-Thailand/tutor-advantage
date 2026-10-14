import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

export const metadata = { title: t("app.chatTitle") };

// Chat screens are pushed screens (<Screen> + <AppBar back>), so there is no
// TabBar here and no legacy .page-shell/.page-content wrapper (its tablet
// padding would inset the full-width AppBar).
export default function ChatLayout({ children }: { children: ReactNode }) {
  return children;
}
