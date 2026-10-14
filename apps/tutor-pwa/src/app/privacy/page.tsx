import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { t, tutorLegalCopy } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("app.privacyMetaTitle"),
  description: t("app.privacyDescription"),
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title={t("app.privacyTitle")}
      icon={Shield}
      intro={tutorLegalCopy.privacy.intro}
      sections={tutorLegalCopy.privacy.sections}
      related={{ href: "/terms", label: t("app.termsTitle") }}
    />
  );
}
