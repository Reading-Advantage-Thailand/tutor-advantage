"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Chip, EmptyState, ListGroup, ListRow, Sheet, UserAvatar } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

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
      leading={<UserAvatar name={student.name} src={student.avatarUrl} size="sm" />}
      title={student.name || t("tutorClass.students.unnamed")}
      subtitle={student.enrolled ? `${t("tutorClass.students.enrolledPrefix")} ${student.enrolled}` : undefined}
      lines={1}
      trailing={
        <Chip tone={student.paid ? "success" : "warning"} size="sm">
          {student.paid ? t("tutorClass.students.paid") : t("tutorClass.students.unpaid")}
        </Chip>
      }
    />
  );
}

/** Enrolled students: first few rows inline, the full list in a sheet. */
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
  const header = `${t("tutorClass.classes.studentsTitle")} ${count}/${maxStudents ?? "–"} ${t("tutorClass.classes.peopleUnit")}`;

  if (enrolledStudents.length === 0) {
    return (
      <section aria-label={header} className="flex flex-col gap-1.5">
        <h2 className="px-1 text-sm font-semibold text-fg-muted">{header}</h2>
        <EmptyState
          compact
          icon={Users}
          tone="teal"
          title={t("tutorClass.students.emptyTitle")}
          description={t("tutorClass.students.emptyDescription")}
          className="rounded-xl border border-dashed border-hairline-strong bg-surface"
        />
      </section>
    );
  }

  return (
    <>
      <ListGroup
        header={header}
        headerAction={
          <span className="text-xs text-fg-muted">
            {t("tutorClass.students.paidSummaryPrefix")} {paidCount}/{enrolledStudents.length}
          </span>
        }
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
      </ListGroup>
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
