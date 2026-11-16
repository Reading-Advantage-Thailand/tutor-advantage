import { redirect } from "next/navigation";
import { FileText, LifeBuoy, ShieldCheck } from "lucide-react";
import { IconTile, ListGroup, ListRow, Page, PageHeader, Section } from "@/components/app";
import { t } from "@/lib/i18n";
import { getActiveTutorSession } from "@/lib/tutor-session";
import { LogoutRow } from "./components/LogoutRow";
import { AppearanceSection, NotificationSection } from "./components/PreferencesSection";
import { ProfileCard } from "./components/ProfileCard";
import { VerificationSection } from "./components/VerificationSection";
import type { SettingsUser } from "./lib/verification";

/**
 * Settings (patterns.md T8): grouped cards. Phones and tablets stack them
 * (profile, payout account and documents, notifications, theme, help, then
 * sign-out on its own at the bottom). From 1280px the documents take the main
 * column and the profile and preferences sit in a 340px rail.
 */
export default async function SettingsPage() {
  // identity /v1/users/me, memoised per request (the dashboard layout already loaded it).
  const session = await getActiveTutorSession();
  if (!session?.user) redirect("/");

  const user = session.user as SettingsUser;

  return (
    <Page width="medium">
      <PageHeader title={t("dashboardSettings.title")} description={t("dashboardSettings.subtitle")} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-x-6 xl:gap-y-5">
        <Section title={t("dashboardSettings.profileSection")} className="xl:col-start-2 xl:row-start-1">
          <ProfileCard user={user} />
        </Section>

        <div className="min-w-0 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <VerificationSection user={user} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 xl:col-start-2 xl:row-start-2">
          <NotificationSection lineNotification={user.settings?.lineNotification} />

          <AppearanceSection />

          <Section title={t("dashboardSettings.helpSection")}>
            <ListGroup>
              <ListRow
                href="/dashboard/support"
                leading={<IconTile icon={LifeBuoy} tone="blue" size="sm" />}
                title={t("dashboardSupport.title")}
                subtitle={t("dashboardSettings.supportRowDescription")}
              />
            </ListGroup>
          </Section>

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

          <Section title={t("dashboardSettings.accountSection")} className="mt-3">
            <ListGroup>
              <LogoutRow />
            </ListGroup>
          </Section>
        </div>
      </div>
    </Page>
  );
}
