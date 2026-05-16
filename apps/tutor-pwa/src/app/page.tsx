import { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.loginTitle"),
  description: t("app.loginDescription"),
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:grid lg:grid-cols-2">
      {/* Brand Hero Panel */}
      <div className="relative flex flex-col bg-brand-900 text-white p-8 lg:p-12 shrink-0 overflow-hidden">
        {/* Decorative gradient circle */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-brand-500/30 blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[20rem] h-[20rem] rounded-full bg-brand-400/20 blur-[80px]" />
        </div>

        {/* Top Bar with Logo & Theme Toggle (Mobile + Desktop) */}
        <div className="relative z-10 flex items-center justify-between mb-12 lg:mb-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <Image 
                src="/icons/icon-192.png" 
                alt="Tutor Advantage" 
                width={36} 
                height={36} 
                className="rounded-xl"
              />
            </div>
            <div>
              <p className="font-bold text-lg text-white">
                Tutor Advantage
              </p>
              <p className="text-xs text-brand-200 font-medium uppercase tracking-widest">
                {t("app.instructorPortal")}
              </p>
            </div>
          </div>
          {/* Theme toggle directly in the hero for mobile */}
          <div className="lg:hidden">
            <ThemeToggle className="text-white hover:bg-white/10" />
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mt-8 lg:mt-0">
          <h2 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-6 tracking-tight">
            {t("app.loginHeroTitlePrefix")} <span className="text-brand-300">{t("app.loginHeroTitleAccent")}</span>
          </h2>
          <p className="text-brand-100 text-lg mb-8 font-medium">
            {t("app.loginHeroDescription")}
          </p>
          <ul className="space-y-4 text-brand-50/80 hidden sm:block font-medium">
            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold shrink-0">OK</div>
              {t("app.loginBenefitLessons")}
            </li>
            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold shrink-0">OK</div>
              {t("app.loginBenefitEarnings")}
            </li>
            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold shrink-0">OK</div>
              {t("app.loginBenefitReferral")}
            </li>
          </ul>
        </div>

        <p className="relative z-10 hidden sm:block text-xs text-brand-200/50 mt-12 lg:mt-auto font-medium uppercase tracking-widest">
          {t("app.loginTrustLine")}
        </p>
      </div>

      {/* Login Form Panel */}
      <div className="flex-1 flex flex-col bg-background relative rounded-t-[2.5rem] -mt-8 lg:mt-0 lg:rounded-none overflow-hidden shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.3)] lg:shadow-none">
        
        {/* Desktop Theme Toggle positioned at top right */}
        <div className="absolute top-8 right-8 hidden lg:block z-50">
          <ThemeToggle className="text-muted-foreground hover:bg-muted" />
        </div>

        {/* Helper spacing for desktop since top bar was moved */}
        <div className="hidden lg:block py-6"></div>
        
        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative z-10 bg-background">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2 text-center lg:text-left">
              <h1 className="text-3xl font-black text-foreground tracking-tight">
                {t("app.welcomeBack")}
              </h1>
              <p className="text-sm font-medium text-muted-foreground">
                {t("app.loginSubtitle")}
              </p>
            </div>

            <LoginForm />

            <div className="pt-6 border-t border-border text-center">
              <p className="text-xs text-muted-foreground font-medium">
                {t("app.loginAgreementPrefix")}{" "}
                <a
                  href="/terms"
                  className="font-bold text-foreground hover:text-primary transition-colors underline underline-offset-4"
                >
                  {t("app.termsOfService")}
                </a>{" "}
                {t("app.and")}{" "}
                <a
                  href="/privacy"
                  className="font-bold text-foreground hover:text-primary transition-colors underline underline-offset-4"
                >
                  {t("app.privacyPolicy")}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
