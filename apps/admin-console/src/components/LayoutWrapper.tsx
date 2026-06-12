"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth, getAdminRole, getAdminEmail } from "../lib/api";
import {
  LayoutDashboard,
  ReceiptText,
  LogOut,
  ChevronsUpDown,
  ShieldCheck,
  FilePenLine,
  AlertTriangle,
  Link as LinkIcon,
  Users,
  ShieldAlert,
  Terminal,
  Database,
  Ticket,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DevToolbar } from "@/components/DevToolbar";
import { t } from "@/lib/i18n";

const FINANCE_ITEMS = [
  { href: "/", label: t("layout.overview"), icon: LayoutDashboard },
  { href: "/settlements", label: t("layout.settlements"), icon: ReceiptText },
  { href: "/adjustments", label: t("layout.adjustments"), icon: FilePenLine },
  { href: "/audit", label: t("layout.audit"), icon: ShieldCheck },
];

const OPS_ITEMS = [
  {
    href: "/operations/exceptions",
    label: t("layout.exceptions"),
    icon: AlertTriangle,
  },
  {
    href: "/operations/legacy-links",
    label: t("layout.legacyLinks"),
    icon: LinkIcon,
  },
];

const USER_RISK_ITEMS = [
  { href: "/users", label: t("layout.usersConsent"), icon: Users },
  { href: "/fraud", label: t("layout.fraud"), icon: ShieldAlert },
  { href: "/coupons", label: t("layout.coupons"), icon: Ticket },
];

function AppSidebar({
  role,
  email,
  onLogout,
}: {
  role: string | null;
  email: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const initial = role ? role[0].toUpperCase() : "A";
  const canAccessUserRisk = role === "ADMIN";

  const [pendingSettlements, setPendingSettlements] = useState(0);
  const [pendingAdjustments, setPendingAdjustments] = useState(0);
  const [pendingVerifications, setPendingVerifications] = useState(0);

  const fetchSummary = useCallback(async () => {
    try {
      if (typeof window === "undefined") return;
      const data = await fetchWithAuth("/v1/admin/overview");
      setPendingSettlements(data.workQueues?.settlements ?? 0);
      setPendingAdjustments(data.workQueues?.adjustments ?? 0);
      setPendingVerifications(data.workQueues?.verifications ?? 0);
    } catch (error) {
      console.warn("Failed to fetch admin sidebar summary:", error);
    }
  }, []);

  useEffect(() => {
    if (!role) return; // Don't poll on login/unauthorized pages
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchSummary, role]);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="bg-brand-500/5 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/20">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text-brand-900 dark:text-brand-50">
                    Tutor Advantage
                  </span>
                  <span className="truncate text-xs font-medium text-brand-600/80 dark:text-brand-400">
                    Admin Console
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {t("layout.financeGroup")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FINANCE_ITEMS.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                const badgeCount =
                  href === "/settlements"
                    ? pendingSettlements
                    : href === "/adjustments"
                      ? pendingAdjustments
                      : 0;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      className={
                        active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                          : "hover:bg-brand-50/50 dark:hover:bg-brand-900/10"
                      }
                    >
                      <Link href={href}>
                        <Icon className={`shrink-0 ${active ? "text-brand-600" : "text-muted-foreground"}`} />
                        <span className={`truncate ${active ? "font-semibold" : "font-medium"}`}>
                          {label}
                        </span>
                        {badgeCount > 0 && (
                          <>
                            <Badge className="h-5 px-1.5 text-[10px] min-w-5 flex items-center justify-center rounded-full leading-none ml-auto group-data-[collapsible=icon]:hidden bg-brand-500 hover:bg-brand-600 text-white border-none shadow-sm">
                              {badgeCount}
                            </Badge>
                            <span className="hidden group-data-[collapsible=icon]:flex absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {t("layout.opsGroup")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {OPS_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      className={
                        active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                          : "hover:bg-brand-50/50 dark:hover:bg-brand-900/10"
                      }
                    >
                      <Link href={href}>
                        <Icon className={`shrink-0 ${active ? "text-brand-600" : "text-muted-foreground"}`} />
                        <span className={`truncate ${active ? "font-semibold" : "font-medium"}`}>
                          {label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canAccessUserRisk && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {t("layout.usersGroup")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {USER_RISK_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href);
                  const badgeCount = href === "/users" ? pendingVerifications : 0;
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className={
                          active
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                            : "hover:bg-brand-50/50 dark:hover:bg-brand-900/10"
                        }
                      >
                        <Link href={href}>
                          <Icon className={`shrink-0 ${active ? "text-brand-600" : "text-muted-foreground"}`} />
                          <span className={`truncate ${active ? "font-semibold" : "font-medium"}`}>
                            {label}
                          </span>
                          {badgeCount > 0 && (
                            <>
                              <Badge className="h-5 px-1.5 text-[10px] min-w-5 flex items-center justify-center rounded-full leading-none ml-auto group-data-[collapsible=icon]:hidden bg-brand-500 hover:bg-brand-600 text-white border-none shadow-sm">
                                {badgeCount}
                              </Badge>
                              <span className="hidden group-data-[collapsible=icon]:flex absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                            </>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* Dev mode — development only */}
        {process.env.NODE_ENV === "development" && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-wider text-orange-500/70">
              {t("layout.developerGroup")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/dev")}
                    tooltip="Dev Mode"
                    className={
                      pathname.startsWith("/dev")
                        ? "bg-orange-500/10 text-orange-600"
                        : "hover:bg-orange-500/5 text-muted-foreground hover:text-orange-600"
                    }
                  >
                    <Link href="/dev">
                      <Terminal className="shrink-0" />
                      <span className="truncate font-medium">Dev Mode</span>
                      <span className="ml-auto text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded group-data-[collapsible=icon]:hidden">
                        DEV
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/dev/database")}
                    tooltip="Database"
                    className={
                      pathname.startsWith("/dev/database")
                        ? "bg-orange-500/10 text-orange-600"
                        : "hover:bg-orange-500/5 text-muted-foreground hover:text-orange-600"
                    }
                  >
                    <Link href="/dev/database">
                      <Database className="shrink-0" />
                      <span className="truncate font-medium">Database</span>
                      <span className="ml-auto text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded group-data-[collapsible=icon]:hidden">
                        DB
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="rounded-xl border border-border/50 bg-card/50 shadow-sm data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-9 w-9 border-2 border-brand-100 dark:border-brand-900">
                    <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                    <span className="truncate font-semibold text-foreground">
                      {role === "ADMIN" ? t("layout.roleAdmin") : role === "FINANCE_CHECKER" ? t("layout.roleFinanceChecker") : role || t("layout.defaultRole")}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" /> {t("layout.online")}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl p-2 shadow-xl border-border/40"
                side="top"
                align="center"
                sideOffset={12}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-brand-100 text-brand-700 text-sm font-bold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-bold text-foreground">
                        {role === "ADMIN" ? t("layout.roleAdmin") : role === "FINANCE_CHECKER" ? t("layout.roleFinanceChecker") : role || t("layout.defaultRole")}
                      </span>
                      <p className="text-xs text-muted-foreground truncate">
                        {email || "—"}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="rounded-lg py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950/30 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="font-semibold">{t("layout.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRole = getAdminRole();
      const savedEmail = getAdminEmail();
      const isPublicPage = pathname === "/login" || pathname === "/unauthorized";

      if (!savedRole && !isPublicPage) {
        router.push("/login");
      } else {
        setRole(savedRole);
        setEmail(savedEmail);
      }
    }
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Failed to clear cookies on server:", e);
    }
    window.location.href = "/login";
  };

  if (pathname === "/login" || pathname === "/unauthorized") {
    return <>{children}</>;
  }

  const PAGE_TITLES: Record<string, string> = {
    "/": t("layout.systemOverview"),
    "/settlements": t("layout.settlements"),
    "/adjustments": t("layout.adjustments"),
    "/audit": t("layout.audit"),
    "/operations/exceptions": t("layout.exceptions"),
    "/operations/legacy-links": t("layout.legacyLinks"),
    "/users": t("layout.usersConsent"),
    "/fraud": t("layout.fraud"),
    "/coupons": t("layout.coupons"),
    "/dev/database": "Database Dev Mode",
    "/dev": t("layout.developerGroup"),
  };
  const pageTitle =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    t("layout.systemOverview");

  return (
    <SidebarProvider>
      <AppSidebar role={role} email={email} onLogout={handleLogout} />
      <SidebarInset className="bg-background/50 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-6 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-brand-600 transition-colors" />
          <Separator orientation="vertical" className="mx-2 h-4 bg-border/60" />
          <h1 className="text-sm font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 dark:bg-brand-900/10 dark:border-brand-800">
              <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(6,199,85,0.5)]" />
              <span className="text-[10px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">{t("layout.productionSystem")}</span>
            </div>
            <ThemeToggle />
          </div>
        </header>
        {/* Page Content - Scrollable Area */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-8 lg:p-10 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </div>
      </SidebarInset>

      {/* Dev-only floating toolbar */}
      {process.env.NODE_ENV === "development" && <DevToolbar />}
    </SidebarProvider>
  );
}


