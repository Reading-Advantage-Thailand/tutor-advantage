import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Inter, Geist } from "next/font/google";
import { LiffProvider } from "@/components/providers/LiffProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { t } from "@/lib/i18n";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className={`${notoSansThai.variable} ${inter.variable}`}>
        <ThemeProvider>
          <LiffProvider>
            <div className="liff-root">{children}</div>
            <Toaster position="top-center" richColors />
          </LiffProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
