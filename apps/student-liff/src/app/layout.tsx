import type { Metadata, Viewport } from "next";
import { LiffProvider } from "@/components/providers/LiffProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { t } from "@/lib/i18n";
import { DevToolbar } from "@/components/dev/DevToolbar";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
            <div className="liff-root">{children}</div>
            <Toaster position="top-center" richColors />
            {process.env.NODE_ENV === "development" && <DevToolbar />}
          </LiffProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
