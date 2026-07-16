"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, MessageSquare } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(to right, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <ThemeToggle className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" />

      <div className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center gap-6 sm:gap-8">
        <Card className="w-full shadow-2xl border-none rounded-3xl overflow-hidden bg-card">
          <CardHeader className="pb-6 pt-10 px-8 text-center bg-red-500/5 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4 shadow-sm border border-red-200 dark:border-red-800">
              <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl font-black text-foreground">
              {t("unauthorized.title")}
            </CardTitle>
            <CardDescription className="text-sm font-medium mt-2">
              {t("unauthorized.title")}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8 text-center space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("unauthorized.description")}
            </p>
            <div className="bg-muted/50 p-4 rounded-2xl border border-border/50">
              <p className="text-xs font-bold text-foreground mb-1">{t("unauthorized.nextStepsTitle")}</p>
              <p className="text-[10px] text-muted-foreground">
                {t("unauthorized.nextStepsDescription")}
              </p>
            </div>
          </CardContent>

          <CardFooter className="p-8 pt-0 flex flex-col gap-3">
            <Button
              className="w-full h-12 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20"
              asChild
            >
              <Link href="https://lin.ee/R7Dccj9" target="_blank">
                <MessageSquare className="mr-2 h-5 w-5" />
                {t("unauthorized.support")}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl font-bold border-border/50 hover:bg-muted"
              asChild
            >
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("unauthorized.backLogin")}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
