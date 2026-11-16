import { FileText } from "lucide-react";
import { IconTile, ListGroup, ListRow } from "@/components/app";
import { t } from "@/lib/i18n";
import { bankBrandLabel, isPdfUrl, type SettingsUser, type VerificationField } from "../lib/verification";
import { FieldStatusChip } from "./FieldStatusChip";
import { stepTile } from "./stepMeta";

function DocumentThumb({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) return <span className="text-sm text-fg-subtle">{t("dashboardSettings.notUploaded")}</span>;
  if (isPdfUrl(url)) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-(--radius-chip) bg-surface-muted px-2.5 text-[0.8125rem] font-medium text-fg">
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
      className="mt-1 aspect-[16/10] w-40 rounded-(--radius-ctl-sm) border border-hairline bg-surface-muted object-contain"
    />
  );
}

/** Leading tone tile of a document row (patterns.md T8). */
function StepTile({ field, user }: { field: VerificationField; user: SettingsUser }) {
  const { icon, tone } = stepTile(field, user.identity?.idType === "PASSPORT");
  return <IconTile icon={icon} tone={tone} />;
}

/** Read-only view of the submitted verification data (verified tutors): one row per document. */
export function VerificationSummary({ user }: { user: SettingsUser }) {
  const settings = user.settings ?? {};
  const identity = user.identity;
  return (
    <ListGroup header={t("dashboardSettings.viewTitle")}>
      <ListRow
        leading={<StepTile field="idCard" user={user} />}
        title={user.identity?.idType === "PASSPORT" ? t("dashboardSettings.passportStep") : t("dashboardSettings.idCardStep")}
        trailing={<FieldStatusChip user={user} field="idCard" />}
        meta={<DocumentThumb url={user.idCardImageUrl} alt={t("dashboardSettings.uploadedAlt")} />}
      />
      <ListRow
        leading={<StepTile field="bankBook" user={user} />}
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
        leading={<StepTile field="address" user={user} />}
        title={t("dashboardSettings.addressStep")}
        subtitle={settings.address || t("dashboardSettings.notUploaded")}
        trailing={<FieldStatusChip user={user} field="address" />}
      />
      {identity?.idType === "PASSPORT" ? (
        <ListRow
          leading={<StepTile field="taxInfo" user={user} />}
          title={t("dashboardSettings.passportTaxInfoStep")}
          subtitle={[
            settings.taxName || "–",
            `${t("dashboardSettings.passportSummary")} ${identity.passportNumberMasked || "–"}`,
            identity.passportNationality || "",
            identity.passportExpiresOn ? `${t("dashboardSettings.expiresOn")} ${identity.passportExpiresOn}` : "",
            identity.teachingLocation === "THAILAND"
              ? t("dashboardSettings.teachingFromThailand")
              : identity.teachingLocation === "ABROAD"
                ? t("dashboardSettings.teachingFromAbroad")
                : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          trailing={<FieldStatusChip user={user} field="taxInfo" />}
        />
      ) : (
        <ListRow
          leading={<StepTile field="taxInfo" user={user} />}
          title={t("dashboardSettings.taxInfoStep")}
          subtitle={
            settings.taxName || settings.nationalId
              ? `${settings.taxName || "–"} · ${settings.nationalId || "–"}`
              : t("dashboardSettings.notUploaded")
          }
          trailing={<FieldStatusChip user={user} field="taxInfo" />}
        />
      )}
      {identity?.workPermitRequired ? (
        <ListRow
          leading={<StepTile field="workPermit" user={user} />}
          title={t("dashboardSettings.workPermitStep")}
          subtitle={identity.workPermitExpiresOn ? `${t("dashboardSettings.expiresOn")} ${identity.workPermitExpiresOn}` : undefined}
          trailing={<FieldStatusChip user={user} field="workPermit" />}
          meta={<DocumentThumb url={identity.workPermitImageUrl} alt={t("dashboardSettings.uploadedAlt")} />}
        />
      ) : null}
    </ListGroup>
  );
}
