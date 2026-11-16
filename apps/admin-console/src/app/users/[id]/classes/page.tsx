"use client";

import { BookOpen } from "lucide-react";
import { AdminStatusChip, DataTable, EmptyState, IconTile, IdentityCell, SectionHeader, type DataTableColumn } from "@/components/app";
import { formatNumber, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useUserDetail, type UserDetailV2 } from "../model";
import "@/locales/th/userDetail";

type ClassRow = UserDetailV2["classes"][number];

export default function UserClassesTab() {
  const { data: user } = useUserDetail();
  if (!user) return null;
  const isTutor = user.role === "TUTOR";
  const caption = isTutor ? t("userDetail.tutorClasses") : t("userDetail.studentClasses");

  const columns: DataTableColumn<ClassRow>[] = [
    {
      // The class and its book in one identity cell (tile + name + book line).
      key: "name",
      header: t("userDetail.colClass"),
      mobile: "primary",
      cell: (row) => (
        <IdentityCell
          leading={<IconTile icon={BookOpen} tone="teal" size="sm" />}
          name={row.name}
          // A plain string, so a long book title is cut with an ellipsis and kept whole in the title.
          secondary={row.bookTitle ? `${t("userDetail.colBook")}: ${row.bookTitle}` : undefined}
        />
      ),
    },
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
    {
      key: "startsAt",
      header: t("userDetail.colStartsAt"),
      cell: (row) => <span className="whitespace-nowrap tabular">{formatThaiDate(row.startsAt)}</span>,
    },
    ...(!isTutor
      ? [
          {
            key: "enrolledAt",
            header: t("userDetail.colEnrolledAt"),
            cell: (row: ClassRow) => <span className="whitespace-nowrap tabular">{formatThaiDate(row.enrolledAt)}</span>,
          },
        ]
      : []),
  ];

  return (
    <section aria-labelledby="user-classes-title" className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        id="user-classes-title"
        title={caption}
        action={
          user.classes.length ? (
            <span className="text-[0.8125rem] text-fg-muted tabular">{t("shell.itemsCount", { count: formatNumber(user.classes.length) })}</span>
          ) : undefined
        }
      />
      <DataTable
        caption={caption}
        columns={columns}
        rows={user.classes}
        getRowKey={(row) => row.enrollmentId ?? row.id}
        empty={<EmptyState as="h3" icon={BookOpen} title={t("userDetail.classesEmpty")} />}
      />
    </section>
  );
}
