import type { Metadata } from "next";
import { MessageCircle, Shield } from "lucide-react";
import { Notice } from "@/components/mobile/Feedback";
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
      footer={
        <Notice
          tone="brand"
          icon={MessageCircle}
          title={copy.contactTitle}
          description={
            <>
              {t("legal.lineOfficial")}
              <br />
              {copy.contactName}
            </>
          }
        />
      }
    />
  );
}
