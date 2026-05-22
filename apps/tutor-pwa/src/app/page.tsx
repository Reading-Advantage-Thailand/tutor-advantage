import { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BarChart3, BookOpenCheck, CheckCircle2, QrCode, ShieldCheck, UsersRound } from "lucide-react";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.loginTitle"),
  description: t("app.loginDescription"),
};

export default function LoginPage() {
  const benefits = [
    { icon: BookOpenCheck, label: t("app.loginBenefitLessons") },
    { icon: BarChart3, label: t("app.loginBenefitEarnings") },
    { icon: QrCode, label: t("app.loginBenefitReferral") },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(160deg,#06c755_0%,#049a42_36%,#037d36_58%,#0f172a_100%)] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-[44vh] flex-col overflow-hidden bg-[linear-gradient(160deg,#06c755_0%,#049a42_36%,#047d36_58%,#0f172a_100%)] p-6 text-white sm:p-8 lg:min-h-screen lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.20),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(255,255,255,0.10),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_45%)]" />
          <div aria-hidden className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/5" />
          <div aria-hidden className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/5" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-white/30 bg-white shadow-lg shadow-black/20">
                <Image
                  src="/icons/icon-192.png"
                  alt="Tutor Advantage"
                  width={36}
                  height={36}
                  className="rounded-xl"
                />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight text-white">
                  Tutor Advantage
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/65">
                  {t("app.instructorPortal")}
                </p>
              </div>
            </div>
            <div className="lg:hidden">
              <ThemeToggle className="rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15" />
            </div>
          </div>

          <div className="relative z-10 flex flex-1 flex-col justify-center py-14 lg:max-w-xl lg:py-20">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/14 px-3 py-1.5 text-xs font-bold text-white/85 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-white" />
              {t("app.loginTrustLine")}
            </div>

            <h1 className="animate-slide-up text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl" style={{ animationDelay: "50ms" }}>
              {t("app.loginHeroTitlePrefix")}{" "}
              <span className="text-white drop-shadow-sm">{t("app.loginHeroTitleAccent")}</span>
            </h1>
            <p className="mt-5 max-w-lg animate-slide-up text-base font-medium leading-8 text-slate-300 sm:text-lg" style={{ animationDelay: "100ms" }}>
              {t("app.loginHeroDescription")}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div key={benefit.label} className="rounded-2xl border border-white/20 bg-white/14 p-4 shadow-sm shadow-black/10 backdrop-blur-sm">
                    <Icon className="mb-3 h-5 w-5 text-white" />
                    <p className="text-sm font-semibold leading-6 text-white/92">{benefit.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 hidden items-center gap-3 text-xs font-semibold text-white/60 sm:flex">
            <ShieldCheck className="h-4 w-4" />
            <span>{t("app.loginTrustLine")}</span>
          </div>
        </section>

        <section className="relative -mt-7 flex flex-col rounded-t-[2rem] bg-background shadow-[0_-20px_60px_rgba(15,23,42,0.18)] lg:mt-0 lg:rounded-none lg:bg-[linear-gradient(180deg,#f8fafc_0%,#eef9f2_100%)] lg:shadow-none dark:lg:bg-[linear-gradient(180deg,#0d1117_0%,#0b1f13_100%)]">
          <div className="absolute right-6 top-6 z-20 hidden lg:block">
            <ThemeToggle className="rounded-xl border border-[#06c755]/20 bg-card text-muted-foreground shadow-sm hover:bg-[#06c755]/10" />
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
            <div className="w-full max-w-md animate-scale-in space-y-7">
              <div className="text-center lg:text-left">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border bg-card shadow-sm lg:mx-0">
                  <UsersRound className="h-7 w-7 text-[#047d36] dark:text-[#86efb0]" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                  {t("app.welcomeBack")}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {t("app.loginSubtitle")}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#06c755]/15 bg-card p-5 shadow-xl shadow-[#047d36]/10 dark:shadow-black/25 sm:p-6">
                <LoginForm />

                <div className="mt-5 rounded-2xl border border-border bg-muted/45 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-[#06c755]" />
                    {t("app.loginTrustLine")}
                  </div>
                  <p className="text-xs font-medium leading-6 text-muted-foreground">
                    {t("app.loginAgreementPrefix")}{" "}
                    <a
                      href="/terms"
                      className="font-bold text-foreground underline underline-offset-4 transition-colors hover:text-[#047d36] dark:hover:text-[#86efb0]"
                    >
                      {t("app.termsOfService")}
                    </a>{" "}
                    {t("app.and")}{" "}
                    <a
                      href="/privacy"
                      className="font-bold text-foreground underline underline-offset-4 transition-colors hover:text-[#047d36] dark:hover:text-[#86efb0]"
                    >
                      {t("app.privacyPolicy")}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
