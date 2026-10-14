import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { t, tutorLegalCopy } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.termsMetaTitle"),
  description: t("app.termsDescription"),
};

export default function TermsPage() {
  return (
    <LegalDocument
      title={t("app.termsTitle")}
      icon={ScrollText}
      intro={tutorLegalCopy.terms.intro}
      sections={tutorLegalCopy.terms.sections}
      related={{ href: "/privacy", label: t("app.privacyTitle") }}
    />
  );
}
