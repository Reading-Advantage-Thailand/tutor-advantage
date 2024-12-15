import Link from "next/link"

import { marketingConfig } from "@/config/marketing-config"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { MainNav } from "@/components/shared/main-nav"
import { SiteFooter } from "@/components/shared/site-footer"

interface MarketingLayoutProps {
  children: React.ReactNode
}

export default async function MarketingLayout({
  children,
}: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center ">
      <header className="container z-40 ">
        <div className="flex h-20 items-center justify-between py-6">
          <MainNav items={marketingConfig.mainNav} />
          <nav>
            <Link
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "px-4"
              )}
              href="/login"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>
      {/* <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 320"
        className="fill-current text-blue-900"
      >
        <path d="M0,96L34.3,106.7C68.6,117,137,139,206,149.3C274.3,160,343,160,411,144C480,128,549,96,617,101.3C685.7,107,754,149,823,154.7C891.4,160,960,128,1029,101.3C1097.1,75,1166,53,1234,53.3C1302.9,53,1371,75,1406,85.3L1440,96L1440,0L1405.7,0C1371.4,0,1303,0,1234,0C1165.7,0,1097,0,1029,0C960,0,891,0,823,0C754.3,0,686,0,617,0C548.6,0,480,0,411,0C342.9,0,274,0,206,0C137.1,0,69,0,34,0L0,0Z"></path>
      </svg> */}
      <main className="w-full flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
