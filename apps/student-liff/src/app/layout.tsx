import type { Metadata, Viewport } from "next";
import { LiffProvider } from "@/components/providers/LiffProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ConsentProvider } from "@/components/providers/consent-provider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { t } from "@/lib/i18n";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
import { NavigationTracker } from "@/components/layout/NavigationTracker";
import { TabBar } from "@/components/layout/TabBar";
import { cookies } from "next/headers";
import { IDENTITY_URL } from "@/lib/service-urls";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06c755",
  viewportFit: "cover",
  // Android: the on-screen keyboard resizes the layout so sticky bottom
  // composers/CTAs stay above it instead of being covered.
  interactiveWidget: "resizes-content",
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

/**
 * Blocking pre-paint theme bootstrap (no light flash for dark-mode users).
 * Contract shared with ThemeProvider: localStorage "ta-theme" is
 * "light" | "dark" | "system"; missing/unknown means "system".
 */
const THEME_BOOTSTRAP = `(function(){try{var s=localStorage.getItem("ta-theme");if(s==="dark"||(s!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

/** Dev-only: keeps React DevTools working with the React 19 renderer. */
const REACT_DEVTOOLS_PATCH = `
  if (typeof window !== 'undefined') {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      const originalInject = hook.inject;
      hook.inject = function(renderer) {
        if (renderer && (renderer.version === undefined || renderer.version === null || renderer.version === '')) {
          renderer.version = '19.0.0';
        }
        return originalInject.apply(this, arguments);
      };
    }
  }
`;

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
        // Never let a slow/cold identity service hold the first paint; on
        // timeout we fail open exactly like a network error.
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        hasConsent = data.user?.userConsents?.some(
          (c: { consentType: string; status: string }) => c.consentType === "TERMS_AND_PRIVACY" && c.status === "ACCEPTED"
        ) ?? false;
      }
    } catch {
      // Allow fallback if network fails or times out
    }
  }

  return (
    <html
      lang="th"
      className="font-sans"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {process.env.NODE_ENV === "development" && (
          <script dangerouslySetInnerHTML={{ __html: REACT_DEVTOOLS_PATCH }} />
        )}
      </head>
      <body>
        <NavigationTracker />
        <ThemeProvider>
          <LiffProvider>
            <ConsentProvider hasConsent={hasConsent}>
              <div className="liff-root">
                {children}
                {/* Persistent bottom tabs (tab roots only); its in-flow spacer must stay inside .liff-root */}
                <TabBar />
              </div>
              <Toaster position="top-center" richColors />
              <DevToolbarLoader />
            </ConsentProvider>
          </LiffProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
