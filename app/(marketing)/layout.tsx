import BackgroundGradient from "@/components/(marketing)/background-gradient"
import NavBar from "@/components/marketing-navbar"
import { SiteFooter } from "@/components/site-footer"

interface MarketingLayoutProps {
  children: React.ReactNode
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <BackgroundGradient />
      <header className="container z-40">
        <NavBar />
      </header>
      <main className="w-full flex-1 flex items-center justify-center flex-col">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
