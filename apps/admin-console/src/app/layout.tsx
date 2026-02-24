import type { Metadata } from "next";
import { Inter } from "next/font/google";
// globals.css
import "./globals.css";
import LayoutWrapper from "../components/LayoutWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tutor Advantage - Admin Console",
  description: "Admin Console for Finance and System settings",
};

// We create a wrapper to check the path for hiding layout on login.
// In App Router, standard way is Route Groups, but for a quick setup, we'll conditionally render sidebar.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-gray-50 flex min-h-screen text-gray-900`}
      >
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
