import type { Metadata } from "next"

import "../styles/globals.css"

import { Inter as FontSans } from "next/font/google"
import localFont from "next/font/local"
import { SessionProvider } from "next-auth/react"

import { auth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import { TailwindIndicator } from "@/components/helpers/tailwind-indicator"
import { Analytics } from "@/components/providers/analytics"
import { ThemeProvider } from "@/components/providers/theme-provider"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontHeading = localFont({
  src: "../assets/fonts/CalSans-SemiBold.woff2",
  variable: "--font-heading",
})

interface RootLayoutProps {
  children: React.ReactNode
}

export const metadata: Metadata = {
  title: "Tutor Advantage",
  description: "Tutor Advantage",
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const session = await auth()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/tutor-advantage-rounded.png" type="image/png" />
      </head>
      <body
        className={cn(
          "bg-background min-h-screen font-sans antialiased",
          fontSans.variable,
          fontHeading.variable
        )}
      >
        <SessionProvider session={session}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Analytics />
            <Toaster />
            <TailwindIndicator />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
