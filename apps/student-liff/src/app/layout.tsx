import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Inter } from "next/font/google";
import { LiffProvider } from "@/components/providers/LiffProvider";
import "./globals.css";

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
  title: "Tutor Advantage — Student Portal",
  description:
    "ระบบสมัครเรียนและเรียนภาษาอังกฤษผ่าน LINE สำหรับนักเรียน — Tutor Advantage Student LIFF Portal",
  keywords: ["tutor advantage", "เรียนภาษาอังกฤษ", "LIFF", "LINE", "ติวเตอร์"],
  robots: "noindex, nofollow", // Private LIFF app
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tutor Advantage",
  },
  openGraph: {
    title: "Tutor Advantage — Student Portal",
    description: "เรียนภาษาอังกฤษกับติวเตอร์ที่คุณไว้วางใจ",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} ${inter.variable}`}>
        <LiffProvider>
          <div className="liff-root">{children}</div>
        </LiffProvider>
      </body>
    </html>
  );
}
