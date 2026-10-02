import { DocumentPageSkeleton } from "@/components/legal/DocumentPage";
import { studentLegalCopy } from "@/lib/content/legal";

export default function TermsLoading() {
  return <DocumentPageSkeleton title={studentLegalCopy.terms.title} />;
}
