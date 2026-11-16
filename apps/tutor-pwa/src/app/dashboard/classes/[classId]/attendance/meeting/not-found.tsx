import { t } from "@/lib/i18n";
import { NotFoundCard } from "../../components/NotFoundCard";

/**
 * notFound() on the meeting route: a malformed date/start or a meeting the
 * API does not know. The class may well exist, so this uses the generic line
 * instead of the class's "not found or not your class" copy.
 */
export default function MeetingNotFound() {
  return <NotFoundCard body={t("app.notFoundBody")} />;
}
