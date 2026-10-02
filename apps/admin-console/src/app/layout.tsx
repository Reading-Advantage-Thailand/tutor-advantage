import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161b22" },
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

  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-dvh bg-app text-fg antialiased">
        <ThemeProvider>
          <AdminShell
            user={user}
            environment={getAppEnvironment()}
            devRoutes={devRoutesEnabled()}
            sidebarCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "rail"}
          >
            {children}
          </AdminShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
