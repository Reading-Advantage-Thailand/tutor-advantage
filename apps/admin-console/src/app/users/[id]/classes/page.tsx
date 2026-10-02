"use client";

import { BookOpen } from "lucide-react";
import { AdminStatusChip, DataTable, EmptyState, type DataTableColumn } from "@/components/app";
import { formatNumber, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useUserDetail, type UserDetailV2 } from "../model";

type ClassRow = UserDetailV2["classes"][number];

export default function UserClassesTab() {
  const { data: user } = useUserDetail();
  if (!user) return null;
  const isTutor = user.role === "TUTOR";

  const columns: DataTableColumn<ClassRow>[] = [
    {
      key: "name",
      header: t("userDetail.colClass"),
      mobile: "primary",
      cell: (row) => <span className="font-medium text-fg">{row.name}</span>,
    },
    { key: "book", header: t("userDetail.colBook"), mobile: "secondary", cell: (row) => row.bookTitle ?? "–" },
    {
      key: "status",
      header: t("userDetail.colStatus"),
      mobile: "trailing",
      cell: (row) => <AdminStatusChip domain={isTutor ? "classStatus" : "enrollment"} status={row.status} />,
    },
    {
      key: "students",
      header: t("userDetail.colStudents"),
      align: "right",
      cell: (row) => `${formatNumber(row.students)}/${formatNumber(row.capacity)}`,
    },
    { key: "startsAt", header: t("userDetail.colStartsAt"), cell: (row) => formatThaiDate(row.startsAt) },
    ...(!isTutor
      ? [{ key: "enrolledAt", header: t("userDetail.colEnrolledAt"), cell: (row: ClassRow) => formatThaiDate(row.enrolledAt) }]
      : []),
  ];

  return (
    <DataTable
      caption={isTutor ? t("userDetail.tutorClasses") : t("userDetail.studentClasses")}
      columns={columns}
      rows={user.classes}
      getRowKey={(row) => row.enrollmentId ?? row.id}
      empty={<EmptyState icon={BookOpen} title={t("userDetail.classesEmpty")} compact />}
    />
  );
}
