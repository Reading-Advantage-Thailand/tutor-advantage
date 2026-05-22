import { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.loginTitle"),
  description: t("app.loginDescription"),
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:grid lg:grid-cols-2">
      {/* Brand Hero Panel */}
      <div className="relative flex flex-col bg-hero-gradient-animated text-white p-8 lg:p-12 shrink-0 overflow-hidden min-h-[50vh] lg:min-h-screen">
        {/* Decorative gradient circle */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] rounded-full bg-brand-400/35 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-1/2 -right-40 w-[24rem] h-[24rem] rounded-full bg-emerald-400/25 blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute -bottom-20 left-1/3 w-[20rem] h-[20rem] rounded-full bg-brand-500/30 blur-[90px] animate-pulse" style={{ animationDuration: '5s' }} />
        </div>

        {/* Top Bar with Logo & Theme Toggle (Mobile + Desktop) */}
        <div className="relative z-10 flex items-center justify-between mb-12 lg:mb-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center hover:rotate-3 transition-transform duration-300">
              <Image 
                src="/icons/icon-192.png" 
                alt="Tutor Advantage" 
                width={36} 
                height={36} 
                className="rounded-xl"
              />
            </div>
            <div>
              <p className="font-extrabold text-lg text-white tracking-tight">
                Tutor Advantage
              </p>
              <p className="text-[10px] text-brand-200 font-bold uppercase tracking-widest">
                {t("app.instructorPortal")}
              </p>
            </div>
          </div>
          {/* Theme toggle directly in the hero for mobile */}
          <div className="lg:hidden">
            <ThemeToggle className="text-white hover:bg-white/10 rounded-xl" />
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mt-8 lg:mt-0">
          <h2 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-6 tracking-tight animate-slide-up" style={{ animationDelay: '50ms' }}>
            {t("app.loginHeroTitlePrefix")} <span className="text-brand-300 font-extrabold shadow-sm">{t("app.loginHeroTitleAccent")}</span>
          </h2>
          <p className="text-brand-100 text-lg mb-8 font-medium animate-slide-up" style={{ animationDelay: '100ms' }}>
            {t("app.loginHeroDescription")}
          </p>
          <ul className="space-y-4 text-brand-50/90 hidden sm:block font-medium stagger animate-slide-up" style={{ animationDelay: '150ms' }}>
            <li className="flex items-center gap-4 bg-white/10 hover:bg-white/15 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm transition-all duration-300 hover:translate-x-1.5">
              <div className="w-8 h-8 rounded-full bg-brand-400/20 border border-brand-300/30 flex items-center justify-center text-brand-300 shrink-0 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                <CheckCircle2 className="w-5 h-5 text-brand-300" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-white">{t("app.loginBenefitLessons")}</span>
            </li>
            <li className="flex items-center gap-4 bg-white/10 hover:bg-white/15 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm transition-all duration-300 hover:translate-x-1.5">
              <div className="w-8 h-8 rounded-full bg-brand-400/20 border border-brand-300/30 flex items-center justify-center text-brand-300 shrink-0 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                <CheckCircle2 className="w-5 h-5 text-brand-300" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-white">{t("app.loginBenefitEarnings")}</span>
            </li>
            <li className="flex items-center gap-4 bg-white/10 hover:bg-white/15 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm transition-all duration-300 hover:translate-x-1.5">
              <div className="w-8 h-8 rounded-full bg-brand-400/20 border border-brand-300/30 flex items-center justify-center text-brand-300 shrink-0 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                <CheckCircle2 className="w-5 h-5 text-brand-300" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-white">{t("app.loginBenefitReferral")}</span>
            </li>
          </ul>
        </div>

        <p className="relative z-10 hidden sm:block text-[10px] text-brand-200/50 mt-12 lg:mt-auto font-bold uppercase tracking-[0.2em]">
          {t("app.loginTrustLine")}
        </p>
      </div>

      {/* Login Form Panel */}
      <div className="flex-1 flex flex-col bg-background relative rounded-t-[2.5rem] -mt-8 lg:mt-0 lg:rounded-none overflow-hidden shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.15)] lg:shadow-none bg-gradient-to-tr from-background via-background to-brand-500/2 dark:to-brand-500/5">
        
        {/* Desktop Theme Toggle positioned at top right */}
        <div className="absolute top-8 right-8 hidden lg:block z-50">
          <ThemeToggle className="text-muted-foreground hover:bg-muted rounded-xl" />
        </div>

        {/* Helper spacing for desktop since top bar was moved */}
        <div className="hidden lg:block py-6"></div>
        
        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 relative z-10">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-[2rem] border border-border/40 bg-card/65 backdrop-blur-xl shadow-xl space-y-8 relative overflow-hidden group animate-scale-in">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none" />
            
            <div className="space-y-2 text-center lg:text-left relative z-10">
              <h1 className="text-3xl font-black text-foreground tracking-tight">
                {t("app.welcomeBack")}
              </h1>
              <p className="text-sm font-semibold text-muted-foreground mt-1">
                {t("app.loginSubtitle")}
              </p>
            </div>

            <div className="relative z-10">
              <LoginForm />
            </div>

            <div className="pt-6 border-t border-border/40 text-center relative z-10">
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
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
