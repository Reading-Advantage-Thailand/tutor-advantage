// Thai UI strings: "confirm" namespace. Owner: G0 (shared confirm copy). Append-only.
import { registerMessages } from "../../lib/i18n";

export const confirm = {
  cancelLabel: "ยกเลิก",
  confirmLabel: "ยืนยัน",
} as const;

registerMessages("confirm", confirm);
