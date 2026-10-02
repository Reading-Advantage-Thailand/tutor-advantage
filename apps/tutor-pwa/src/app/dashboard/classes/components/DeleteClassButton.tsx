"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { deleteClass } from "../actions";
import { triggerCancelICS } from "./cancel-ics";

/**
 * DEV-only permanent delete. Lives in its own small module so the classes
 * list doesn't pull in the class-detail code.
 */
export function DeleteClassButton({ classId, className }: { classId: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteClass(classId);
      // Auto-remove from phone calendar after deletion
      if (className) triggerCancelICS(classId, className);
      setOpen(false);
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error && error.message ? error.message : t("tutorClass.detail.deleteFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-danger-fg hover:bg-danger-bg hover:text-danger-fg"
        aria-label={`${t("tutorClass.ui.devDelete")} ${className ?? ""}`.trim()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
        {t("tutorClass.ui.devDelete")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t("tutorClass.detail.deleteTitle")}
        description={`${t("tutorClass.detail.deleteDescription1")}${t("tutorClass.detail.deleteDescription2")}${t("tutorClass.detail.deleteDescription3")}`}
        confirmLabel={loading ? t("tutorClass.detail.deleting") : t("tutorClass.detail.confirmDelete")}
        cancelLabel={t("tutorClass.detail.cancel")}
        loading={loading}
        onConfirm={handleDelete}
      />
    </>
  );
}
