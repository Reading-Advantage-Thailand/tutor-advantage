"use client";

import { useState } from "react";
import { Check, Users } from "lucide-react";
import { Chip, EmptyState, ListRow, Sheet, UserAvatar } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { PanelCard } from "./PanelCard";

export type EnrolledStudent = {
  name?: string | null;
  avatarUrl?: string | null;
  /** Already formatted by the API, e.g. "2 ต.ค. 2569". */
  enrolled?: string | null;
  paid?: boolean;
};

const PREVIEW_COUNT = 5;

function StudentRow({ student }: { student: EnrolledStudent }) {
  return (
    <ListRow
      leading={<UserAvatar name={student.name} src={student.avatarUrl} />}
      title={student.name || t("tutorClass.students.unnamed")}
      subtitle={student.enrolled ? `${t("tutorClass.students.enrolledPrefix")} ${student.enrolled}` : undefined}
      lines={1}
      trailing={
        <Chip tone={student.paid ? "success" : "warning"} size="sm" icon={student.paid ? Check : undefined} dot={!student.paid}>
          {student.paid ? t("tutorClass.students.paid") : t("tutorClass.students.unpaid")}
        </Chip>
      }
    />
  );
}

/** Enrolled students (patterns.md T3 roster): first few rows inline, the full list in a sheet. */
export function StudentsPanel({
  enrolledStudents = [],
  students,
  maxStudents,
}: {
  enrolledStudents?: EnrolledStudent[];
  students?: number;
  maxStudents?: number;
}) {
  const [open, setOpen] = useState(false);
  const count = students ?? enrolledStudents.length;
  const paidCount = enrolledStudents.filter((student) => student.paid).length;
  // "นักเรียน 4/30 คน": the count stays with its unit when the title wraps (text content unchanged).
  const header = (
    <>
      {t("tutorClass.classes.studentsTitle")}{" "}
      <span className="whitespace-nowrap">{`${count}/${maxStudents ?? "–"} ${t("tutorClass.classes.peopleUnit")}`}</span>
    </>
  );

  if (enrolledStudents.length === 0) {
    return (
      <PanelCard id="class-students-title" icon={Users} tone="teal" title={header} flush>
        {/* The class page's one Reedy (patterns.md empty state, tutor). */}
        <EmptyState
          compact
          mascot
          title={t("tutorClass.students.emptyTitle")}
          description={t("tutorClass.students.emptyDescription")}
        />
      </PanelCard>
    );
  }

  return (
    <>
      <PanelCard
        id="class-students-title"
        icon={Users}
        tone="teal"
        title={header}
        action={
          <span className="text-[0.8125rem] font-medium text-fg-muted tabular">
            {t("tutorClass.students.paidSummaryPrefix")} {paidCount}/{enrolledStudents.length}
          </span>
        }
        flush
      >
        {enrolledStudents.slice(0, PREVIEW_COUNT).map((student, index) => (
          <StudentRow key={`${student.name}-${index}`} student={student} />
        ))}
        {enrolledStudents.length > PREVIEW_COUNT ? (
          <ListRow
            onClick={() => setOpen(true)}
            title={<span className="text-brand-fg">{`${t("shell.viewAll")} (${enrolledStudents.length} ${t("tutorClass.classes.peopleUnit")})`}</span>}
            chevron
          />
        ) : null}
      </PanelCard>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`${t("tutorClass.students.listTitle")} (${enrolledStudents.length} ${t("tutorClass.classes.peopleUnit")})`}
        description={t("tutorClass.students.listDescription")}
        bodyClassName="px-0"
        footer={
          <Button variant="outline" size="lg" className="w-full md:hidden" onClick={() => setOpen(false)}>
            {t("shell.close")}
          </Button>
        }
      >
        <div className="flex flex-col">
          {enrolledStudents.map((student, index) => (
            <StudentRow key={`${student.name}-${index}`} student={student} />
          ))}
        </div>
      </Sheet>
    </>
  );
}
