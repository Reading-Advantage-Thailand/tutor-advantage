import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { notoThai } from "./fonts";
import { AdminShell } from "@/components/app/AdminShell";
import { SIDEBAR_COOKIE } from "@/components/app/constants";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ADMIN_TOKEN_COOKIE, devRoutesEnabled, getAppEnvironment, verifyAdminToken } from "@/lib/security";

export const metadata: Metadata = {
  title: { default: "Tutor Advantage · คอนโซลผู้ดูแลระบบ", template: "%s · Tutor Advantage Admin" },
  description: "คอนโซลการเงินและการจัดการระบบ Tutor Advantage",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Browser chrome matches the app bar (--surface-nav light #ffffff / dark #161c1b).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161c1b" },
  ],
};

/**
 * Root layout: verifies the admin session server-side (the middleware already
 * guarded the route) and hands the shell a trusted user. Reading cookies makes
 * every route dynamic, so no `force-dynamic` is needed.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = await verifyAdminToken(cookieStore.get(ADMIN_TOKEN_COOKIE)?.value);
  const picture = cookieStore.get("admin_picture")?.value || null;
  const user = session ? { ...session, picture: picture && /^https:\/\//.test(picture) ? picture : null } : null;
  // No saved choice = "auto" (rail at 1024–1279px, full nav from 1280px, in CSS).
  const savedSidebar = cookieStore.get(SIDEBAR_COOKIE)?.value;
  const sidebarMode = savedSidebar === "rail" || savedSidebar === "full" ? savedSidebar : "auto";

  return (
    <html lang="th" className={notoThai.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-app text-fg antialiased">
        <ThemeProvider>
          <AdminShell
            user={user}
            environment={getAppEnvironment()}
            devRoutes={devRoutesEnabled()}
            sidebarMode={sidebarMode}
          >
            {children}
          </AdminShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
