import { DocumentPageSkeleton } from "@/components/legal/DocumentPage";
import { studentLegalCopy } from "@/lib/content/legal";

export default function PrivacyLoading() {
  return <DocumentPageSkeleton title={studentLegalCopy.privacy.title} />;
}
