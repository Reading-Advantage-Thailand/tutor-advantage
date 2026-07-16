import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { t } from "@/lib/i18n";
import { DevToolbar } from "@/components/dev/DevToolbar";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Tutor PWA - Tutor Advantage",
  description: t("app.rootDescription"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tutor PWA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Auto-clear stale service workers and cache storage in dev mode 
                // to prevent hydration mismatches from old PWA builds.
                if (typeof window !== 'undefined') {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for (var registration of registrations) {
                        registration.unregister();
                      }
                    });
                  }
                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      for (var key of keys) {
                        caches.delete(key);
                      }
                    });
                  }
                }
              `,
            }}
          />
        )}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {process.env.NODE_ENV === "development" && <DevToolbar />}
        </ThemeProvider>
      </body>
    </html>
  );
}
