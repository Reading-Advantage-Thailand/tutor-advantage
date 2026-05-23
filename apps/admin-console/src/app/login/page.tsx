"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, AlertCircle, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const ROLE_DESCRIPTIONS: Record<
  string,
  { label: string; description: string; access: string[] }
> = {
  ADMIN: {
    label: t("login.superAdminLabel"),
    description: t("login.superAdminDescription"),
    access: [
      t("login.superAdminAccess1"),
      t("login.superAdminAccess2"),
      t("login.superAdminAccess3"),
      t("login.superAdminAccess4"),
    ],
  },
  FINANCE_CHECKER: {
    label: t("login.financeCheckerLabel"),
    description: t("login.financeCheckerDescription"),
    access: [
      t("login.financeCheckerAccess1"),
      t("login.financeCheckerAccess2"),
      t("login.financeCheckerAccess3"),
    ],
  },
};

export default function LoginPage() {
  const [role, setRole] = useState("ADMIN");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    // Redirect directly to our local Next API route which will redirect to Google auth
    window.location.href = "/api/auth/google";
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/");
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLE_DESCRIPTIONS[role];

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
        {/* Branding */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-xl shadow-brand-500/20">
            <ShieldCheck className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Tutor Advantage
            </h1>
            <p className="text-sm sm:text-base font-medium text-muted-foreground mt-1 uppercase tracking-widest">
              Admin Console
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="w-full shadow-2xl border-none rounded-3xl overflow-hidden bg-card">
          <CardHeader className="pb-6 bg-muted/20 border-b">
            <CardTitle className="text-lg flex items-center justify-center gap-2 font-bold">
              <Lock className="w-5 h-5 text-brand-600" />
              {t("login.title")}
            </CardTitle>
            <CardDescription className="text-center">
              {t("login.description")}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Primary Google Login */}
            <Button
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              variant="outline"
              className="w-full h-14 rounded-xl font-bold bg-white text-gray-800 hover:bg-gray-50 border-gray-200 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow-sm relative overflow-hidden"
            >
              {googleLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                  {t("login.connectingGoogle")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("login.continueGoogle")}
                </span>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-bold tracking-widest">
                  {t("login.or")}
                </span>
              </div>
            </div>

            {/* Dev Login Toggle - Only visible in development */}
            {process.env.NODE_ENV === "development" && (
              <div className="rounded-2xl border border-border/50 overflow-hidden transition-all duration-300 bg-muted/10">
                <button
                  type="button"
                  onClick={() => setShowDevLogin(!showDevLogin)}
                  className="w-full flex items-center justify-between p-4 text-sm font-bold text-foreground hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                    <AlertCircle className="w-4 h-4" />
                    {t("login.devMode")}
                  </div>
                  {showDevLogin ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {showDevLogin && (
                  <div className="p-4 pt-0 border-t border-border/50 bg-background/50">
                    <form onSubmit={handleDevLogin} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("login.roleLabel")}</Label>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger id="role" className="w-full h-11 rounded-xl border-2 focus:ring-brand-500">
                            <SelectValue placeholder={t("login.rolePlaceholder")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/50">
                            <SelectItem value="ADMIN">Super Admin</SelectItem>
                            <SelectItem value="FINANCE_CHECKER">
                              Finance Checker
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedRole && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-bold text-amber-700 dark:text-amber-500">
                              {selectedRole.label}
                            </span>
                          </div>
                          <ul className="space-y-1">
                            {selectedRole.access.slice(0,2).map((item: string) => (
                              <li
                                key={item}
                                className="flex items-center gap-2 text-[10px] font-medium text-amber-900/60 dark:text-amber-200/60"
                              >
                                <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-3 py-2.5 text-xs font-bold text-red-600 dark:text-red-400">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={loading || googleLoading}
                        className="w-full h-11 rounded-xl font-bold bg-foreground text-background hover:bg-foreground/90"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                            {t("login.creatingToken")}
                          </span>
                        ) : (
                          t("login.mockJwt")
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-muted/10 p-6 flex flex-col gap-2 text-center border-t border-border/50">
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
              {t("login.footerLine1")}
              {t("login.footerLine2")}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
