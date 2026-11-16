import { Users } from "lucide-react";
import { IconTile, ListGroup, ListRow, Spinner, UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { initiateKey, type EnrolledChatClass } from "../_lib/conversations";

interface ClassChatGroupProps {
  cls: EnrolledChatClass;
  /** Key of the row whose /chat/initiate request is running (see initiateKey). */
  initiating: string | null;
  onStart: (type: "DIRECT" | "GROUP", classId: string, tutorUserId?: string) => void;
}

/** 40px round placeholder with a spinner while that row's chat is being opened. */
function BusyTile() {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-full bg-tile-blue text-icon-blue">
      <Spinner size="md" label={t("common.pleaseWait")} />
    </span>
  );
}

/**
 * "Start a new chat" card for one class: a private chat with the tutor (their
 * avatar) and the class group chat (group tile). Flat rows inside one card.
 */
export function ClassChatGroup({ cls, initiating, onStart }: ClassChatGroupProps) {
  const directKey = initiateKey("DIRECT", cls.id);
  const groupKey = initiateKey("GROUP", cls.id);

  return (
    <ListGroup header={cls.name}>
      <ListRow
        onClick={() => onStart("DIRECT", cls.id, cls.tutorUserId)}
        disabled={initiating !== null && initiating !== directKey}
        chevron
        leading={initiating === directKey ? <BusyTile /> : <UserAvatar name={cls.tutorName} decorative />}
        title={t("chat.directChatTitle")}
        subtitle={`${t("chat.directChatPrefix")} ${cls.tutorName}`}
      />
      <ListRow
        onClick={() => onStart("GROUP", cls.id)}
        disabled={initiating !== null && initiating !== groupKey}
        chevron
        leading={initiating === groupKey ? <BusyTile /> : <IconTile icon={Users} tone="purple" size="sm" shape="circle" />}
        title={t("chat.groupChatTitle")}
        subtitle={thaiCopy(t("chat.groupChatDescription"))}
      />
    </ListGroup>
  );
}
