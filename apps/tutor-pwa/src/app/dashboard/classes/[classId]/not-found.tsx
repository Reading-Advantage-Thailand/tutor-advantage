import { t } from "@/lib/i18n";
import { NotFoundCard } from "./components/NotFoundCard";

/**
 * notFound() for the class itself (no such class, or not this tutor's): the
 * class page, its attendance history and its setup route. The meeting route
 * has its own not-found with the generic line, since a bad meeting URL on a
 * real class is not a missing class.
 */
export default function ClassNotFound() {
  return <NotFoundCard body={t("tutorClass.setup.errorNotFound")} />;
}
