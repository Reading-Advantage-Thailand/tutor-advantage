"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Sheet, TextField } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { attendanceMeetingHref, toBangkokDateKey, validateAdhocMeeting, type AdhocErrors } from "./attendanceModel";

const FORM_ID = "attendance-adhoc-form";

/** "เพิ่มคาบชดเชย": picks a date and time, then opens the mark page. Nothing is stored until marks are saved. */
export function AdhocMeetingButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  const [form, setForm] = useState({ date: "", start: "", end: "" });
  const [errors, setErrors] = useState<AdhocErrors>({});

  const handleOpen = () => {
    const key = toBangkokDateKey(new Date());
    setToday(key);
    setForm({ date: key, start: "", end: "" });
    setErrors({});
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateAdhocMeeting(form, new Date());
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    router.push(attendanceMeetingHref(classId, { date: form.date, start: form.start, end: form.end || null }));
  };

  return (
    <>
      <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={handleOpen}>
        <Plus aria-hidden="true" className="size-4" />
        {t("tutorClass.attendance.adhocAction")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("tutorClass.attendance.adhocTitle")}
        description={t("tutorClass.attendance.adhocDescription")}
        width={440}
        footer={
          <Button type="submit" form={FORM_ID} size="lg" className="w-full">
            {t("tutorClass.attendance.adhocContinue")}
          </Button>
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            label={t("tutorClass.attendance.adhocDate")}
            type="date"
            max={today}
            required
            value={form.date}
            error={errors.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t("tutorClass.attendance.adhocStart")}
              type="time"
              required
              value={form.start}
              error={errors.start}
              onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))}
            />
            <TextField
              label={t("tutorClass.attendance.adhocEnd")}
              type="time"
              optional
              value={form.end}
              error={errors.end}
              onChange={(event) => setForm((prev) => ({ ...prev, end: event.target.value }))}
            />
          </div>
        </form>
      </Sheet>
    </>
  );
}
