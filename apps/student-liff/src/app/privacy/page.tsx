import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { BusinessContactCard } from "@/components/legal/BusinessContactCard";
import { DocumentPage } from "@/components/legal/DocumentPage";
import { studentLegalCopy } from "@/lib/content/legal";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("legal.privacyMetaTitle") };

/** Static privacy policy (server component). */
export default function PrivacyPage() {
  const copy = studentLegalCopy.privacy;
  return (
    <DocumentPage
      title={copy.title}
      icon={Shield}
      tone="brand"
      intro={copy.intro}
      sections={copy.sections}
      footer={<BusinessContactCard />}
    />
  );
}
