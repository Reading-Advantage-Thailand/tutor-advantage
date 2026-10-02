import { redirect } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { IconTile, ListGroup, ListRow, Page, PageHeader, Section } from "@/components/app";
import { t } from "@/lib/i18n";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { LogoutRow } from "./components/LogoutRow";
import { AppearanceSection, NotificationSection } from "./components/PreferencesSection";
import { ProfileCard } from "./components/ProfileCard";
import { VerificationSection } from "./components/VerificationSection";
import type { SettingsUser } from "./lib/verification";

export default async function SettingsPage() {
  // identity /v1/users/me, memoised per request (the dashboard layout already loaded it).
  const session = await getActiveTutorSession();
  if (!session?.user) redirect("/");

  const user = session.user as SettingsUser;

  return (
    <Page width="narrow">
      <PageHeader title={t("dashboardSettings.title")} description={t("dashboardSettings.subtitle")} />

      <Section title={t("dashboardSettings.profileSection")}>
        <ProfileCard user={user} />
      </Section>

      <VerificationSection user={user} />

      <NotificationSection lineNotification={user.settings?.lineNotification} />

      <AppearanceSection />

      <Section title={t("dashboardSettings.policySection")}>
        <ListGroup>
          <ListRow
            href="/terms"
            leading={<IconTile icon={FileText} tone="neutral" size="sm" />}
            title={t("dashboardSettings.termsTitle")}
            subtitle={t("dashboardSettings.termsDescription")}
          />
          <ListRow
            href="/privacy"
            leading={<IconTile icon={ShieldCheck} tone="neutral" size="sm" />}
            title={t("dashboardSettings.privacyTitle")}
            subtitle={t("dashboardSettings.privacyDescription")}
          />
        </ListGroup>
      </Section>

      <Section title={t("dashboardSettings.accountSection")}>
        <ListGroup>
          <LogoutRow />
        </ListGroup>
      </Section>
    </Page>
  );
}
