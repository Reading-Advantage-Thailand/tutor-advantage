"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ReceiptText,
  ShieldCheck,
  ClockAlert,
  CheckCircle2,
  Activity,
  ArrowRight,
  Info,
} from "lucide-react";

const CURRENT_PERIOD = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
});

const QUICK_ACTIONS = [
  {
    title: "Run Settlement Preview",
    description: "Generate a snapshot for the current period before approval.",
    href: "/settlements",
    icon: ReceiptText,
    badge: null,
  },
  {
    title: "Review Pending Approvals",
    description: "Makers-Checkers: approve or reject payout batches.",
    href: "/settlements",
    icon: ClockAlert,
    badge: "Action Required",
  },
  {
    title: "Audit Log",
    description: "Query all payout-affecting events with full traceability.",
    href: "/settlements",
    icon: ShieldCheck,
    badge: null,
  },
];

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  variant?: "default" | "warning" | "success";
}) {
  const valueColor =
    variant === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : variant === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRole(localStorage.getItem("admin_role"));
    }
  }, []);

  return (
    <div className="space-y-6 w-full">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            Settlement period:{" "}
            <span className="font-medium text-foreground">
              {CURRENT_PERIOD}
            </span>
          </p>
        </div>
        {role && (
          <Badge
            variant="outline"
            className="border-primary/30 text-primary bg-primary/5 self-start sm:self-auto w-fit"
          >
            {role}
          </Badge>
        )}
      </div>

      {/* Audit Notice */}
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-700 dark:text-amber-300 text-sm font-semibold">
          Audit Mode Active
        </AlertTitle>
        <AlertDescription className="text-amber-700/80 dark:text-amber-400/80 text-xs leading-relaxed">
          All actions in this console are logged and reconstructable from
          immutable records. Every monetary event is separately attributed from
          payout data.
        </AlertDescription>
      </Alert>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Settlements"
          value="--"
          description="Last 30 days"
          icon={ReceiptText}
        />
        <StatCard
          title="Pending Approvals"
          value="--"
          description="Requires Checker action"
          icon={ClockAlert}
          variant="warning"
        />
        <StatCard
          title="System Health"
          value="100%"
          description="All services operational"
          icon={Activity}
          variant="success"
        />
      </div>

      <Separator />

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Finance Admin Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="group hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {action.badge && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px]"
                      >
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground mt-2">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {action.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-primary hover:text-primary hover:bg-primary/5 px-0"
                  >
                    <Link href={action.href}>
                      Open
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Compliance Note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground/60">
        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Settlement math uses Satang integers to prevent rounding errors.
          Settled payout lineage is never retroactively rewritten. Refunds and
          chargebacks appear as clawbacks in the following period.
        </span>
      </div>
    </div>
  );
}
