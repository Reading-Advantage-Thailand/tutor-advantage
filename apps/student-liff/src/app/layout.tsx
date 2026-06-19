import type { Metadata, Viewport } from "next";
import { LiffProvider } from "@/components/providers/LiffProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ConsentProvider } from "@/components/providers/consent-provider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { t } from "@/lib/i18n";
import { DevToolbar } from "@/components/dev/DevToolbar";
import { cookies } from "next/headers";
import { IDENTITY_URL } from "@/lib/service-urls";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06c755",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Tutor Advantage - Student Portal",
  description: t("app.rootDescription"),
  keywords: ["tutor advantage", t("app.keywordEnglishLearning"), "LIFF", "LINE", "tutor"],
  robots: "noindex, nofollow",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tutor Advantage",
  },
  openGraph: {
    title: "Tutor Advantage - Student Portal",
    description: t("app.openGraphDescription"),
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("student-session")?.value;
  let hasConsent = true;

  if (token) {
    try {
      const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        hasConsent = data.user?.userConsents?.some(
          (c: { consentType: string; status: string }) => c.consentType === "TERMS_AND_PRIVACY" && c.status === "ACCEPTED"
        ) ?? false;
      }
    } catch {
      // Allow fallback if network fails
    }
  }

  return (
    <html
      lang="th"
      className="font-sans"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body>
        <ThemeProvider>
          <LiffProvider>
            <ConsentProvider hasConsent={hasConsent}>
              <div className="liff-root">{children}</div>
              <Toaster position="top-center" richColors />
              {process.env.NODE_ENV === "development" && <DevToolbar />}
            </ConsentProvider>
          </LiffProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
