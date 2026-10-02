"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Chip, toast } from "@/components/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { updateClassStatus } from "../../actions";
import { CLASS_STATUS, classStatusInfo, type ClassStatus } from "../../components/class-status";

const DOT: Record<ClassStatus, string> = {
  open: "bg-success-solid",
  full: "bg-warning-solid",
  closed: "bg-fg-subtle",
};

/** Status chip with a menu to change the enrolment status. */
export function ClassStatusToggle({
  classId,
  initialStatus,
}: {
  classId: string;
  initialStatus: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (status: ClassStatus) => {
    if (status === initialStatus || loading) return;
    setLoading(true);
    try {
      await updateClassStatus(classId, status);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error && error.message ? error.message : t("tutorClass.errors.updateClassStatus"));
    } finally {
      setLoading(false);
    }
  };

  const current = classStatusInfo(initialStatus);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        aria-label={`${t("tutorClass.ui.changeStatus")}: ${current.label}`}
        className={cn("rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40", loading && "opacity-60")}
      >
        <Chip tone={current.tone} className="cursor-pointer gap-1 pr-1.5 whitespace-nowrap">
          {current.label}
          <ChevronDown aria-hidden="true" className="ml-0.5 inline size-3.5 align-[-2px]" />
        </Chip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {(Object.keys(CLASS_STATUS) as ClassStatus[]).map((status) => (
          <DropdownMenuItem key={status} onClick={() => handleStatusChange(status)}>
            <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[status])} />
            <span className={cn("font-medium", status === initialStatus ? "text-fg" : "text-fg-muted")}>
              {CLASS_STATUS[status].label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
