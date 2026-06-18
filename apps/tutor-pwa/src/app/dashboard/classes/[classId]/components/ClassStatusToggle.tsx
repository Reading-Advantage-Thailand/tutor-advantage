"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { updateClassStatus } from "../../actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ClassStatusToggle({
  classId,
  initialStatus,
}: {
  classId: string;
  initialStatus: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (status: "open" | "full" | "closed") => {
    if (status === initialStatus || loading) return;
    setLoading(true);
    try {
      await updateClassStatus(classId, status);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusMap = {
    open: {
      label: t("tutorClass.classes.statusOpen"),
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    full: {
      label: t("tutorClass.classes.statusFull"),
      className:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    closed: {
      label: t("tutorClass.classes.statusClosed"),
      className: "bg-muted text-muted-foreground border-border",
    },
  } as Record<string, { label: string; className: string }>;

  const currentStatus = statusMap[initialStatus] || statusMap["closed"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border transition-opacity ${currentStatus.className} ${loading ? "opacity-50" : ""}`}
      >
        {currentStatus.label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleStatusChange("open")}>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {t("tutorClass.classes.statusOpen")}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("full")}>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {t("tutorClass.classes.statusFull")}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("closed")}>
          <span className="text-muted-foreground font-medium">{t("tutorClass.classes.statusClosed")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
