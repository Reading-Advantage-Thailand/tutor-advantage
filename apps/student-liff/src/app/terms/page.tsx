import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { DocumentPage } from "@/components/legal/DocumentPage";
import { studentLegalCopy } from "@/lib/content/legal";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("legal.termsMetaTitle") };

/** Static terms of use (server component). */
export default function TermsPage() {
  const copy = studentLegalCopy.terms;
  return (
    <DocumentPage
      title={copy.title}
      icon={FileText}
      tone="blue"
      intro={copy.intro}
      sections={copy.sections}
      footer={<p className="px-2 text-center text-xs leading-[1.6] text-fg-muted">{copy.footer}</p>}
    />
  );
}
