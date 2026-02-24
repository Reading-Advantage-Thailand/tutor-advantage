import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutWrapper from "../components/LayoutWrapper";
import { ThemeProvider } from "../components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tutor Advantage - Admin Console",
  description: "Admin Console for Finance and System settings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-background text-foreground`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
