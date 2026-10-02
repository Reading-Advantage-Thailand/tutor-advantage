import { FileText } from "lucide-react";
import { ListGroup, ListRow } from "@/components/app";
import { t } from "@/lib/i18n";
import { bankBrandLabel, isPdfUrl, type SettingsUser } from "../lib/verification";
import { FieldStatusChip } from "./FieldStatusChip";

function DocumentThumb({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) return <span className="text-fg-subtle">{t("dashboardSettings.notUploaded")}</span>;
  if (isPdfUrl(url)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fg">
        <FileText aria-hidden="true" className="size-4" />
        PDF
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="mt-1 aspect-video w-full max-w-sm rounded-lg border border-hairline bg-surface-muted object-contain"
    />
  );
}

/** Read-only view of the submitted verification data (verified tutors). */
export function VerificationSummary({ user }: { user: SettingsUser }) {
  const settings = user.settings ?? {};
  return (
    <ListGroup header={t("dashboardSettings.viewTitle")}>
      <ListRow
        title={t("dashboardSettings.idCardStep")}
        trailing={<FieldStatusChip user={user} field="idCard" />}
        meta={<DocumentThumb url={user.idCardImageUrl} alt={t("dashboardSettings.uploadedAlt")} />}
      />
      <ListRow
        title={t("dashboardSettings.bankBookStep")}
        subtitle={
          [
            settings.bankBrand ? `${t("dashboardSettings.bankBrandLabel")} ${bankBrandLabel(settings.bankBrand)}` : "",
            settings.bankAccountNumber ? `${t("dashboardSettings.bankAccountLabel")} ${settings.bankAccountNumber}` : "",
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        trailing={<FieldStatusChip user={user} field="bankBook" />}
        meta={<DocumentThumb url={user.bankBookImageUrl} alt={t("dashboardSettings.uploadedAlt")} />}
      />
      <ListRow
        title={t("dashboardSettings.addressStep")}
        subtitle={settings.address || t("dashboardSettings.notUploaded")}
        trailing={<FieldStatusChip user={user} field="address" />}
      />
      <ListRow
        title={t("dashboardSettings.taxInfoStep")}
        subtitle={
          settings.taxName || settings.nationalId
            ? `${settings.taxName || "–"} · ${settings.nationalId || "–"}`
            : t("dashboardSettings.notUploaded")
        }
        trailing={<FieldStatusChip user={user} field="taxInfo" />}
      />
    </ListGroup>
  );
}
