import { User, Users } from "lucide-react";
import { IconTile, ListGroup, ListRow, Spinner } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { initiateKey, type EnrolledChatClass } from "../_lib/conversations";

interface ClassChatGroupProps {
  cls: EnrolledChatClass;
  /** Key of the row whose /chat/initiate request is running (see initiateKey). */
  initiating: string | null;
  onStart: (type: "DIRECT" | "GROUP", classId: string, tutorUserId?: string) => void;
}

function BusyTile({ tone }: { tone: "blue" | "purple" }) {
  return (
    <span
      className={
        tone === "blue"
          ? "inline-flex size-10 items-center justify-center rounded-xl bg-tile-blue text-icon-blue"
          : "inline-flex size-10 items-center justify-center rounded-xl bg-tile-purple text-icon-purple"
      }
    >
      <Spinner size="md" label={t("common.pleaseWait")} />
    </span>
  );
}

/** "Start a new chat" group for one class: private chat with the tutor, and the class group chat. */
export function ClassChatGroup({ cls, initiating, onStart }: ClassChatGroupProps) {
  const directKey = initiateKey("DIRECT", cls.id);
  const groupKey = initiateKey("GROUP", cls.id);

  return (
    <ListGroup header={cls.name}>
      <ListRow
        onClick={() => onStart("DIRECT", cls.id, cls.tutorUserId)}
        disabled={initiating !== null && initiating !== directKey}
        chevron
        leading={initiating === directKey ? <BusyTile tone="blue" /> : <IconTile icon={User} tone="blue" />}
        title={t("chat.directChatTitle")}
        subtitle={`${t("chat.directChatPrefix")} ${cls.tutorName}`}
      />
      <ListRow
        onClick={() => onStart("GROUP", cls.id)}
        disabled={initiating !== null && initiating !== groupKey}
        chevron
        leading={initiating === groupKey ? <BusyTile tone="purple" /> : <IconTile icon={Users} tone="purple" />}
        title={t("chat.groupChatTitle")}
        subtitle={t("chat.groupChatDescription")}
      />
    </ListGroup>
  );
}
