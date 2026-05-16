import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { t, tutorLegalCopy } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.termsMetaTitle"),
  description: t("app.termsDescription"),
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-3xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("app.backToLogin")}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 container max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {t("app.termsTitle")}
            </h1>
            <p className="text-muted-foreground">{t("app.lastUpdated")}</p>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="lead">{tutorLegalCopy.terms.intro}</p>
            {tutorLegalCopy.terms.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {"body" in section && <p>{section.body}</p>}
                {"items" in section && (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <div className="mt-12 py-6 border-t text-sm text-muted-foreground text-center">
              <a
                href="https://lin.ee/zqTz6feg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold hover:underline"
              >
                LINE Support
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
