import { cookies } from "next/headers";
import { AppShell } from "@/components/app/AppShell";
import { SIDEBAR_COOKIE } from "@/components/app/constants";
import type { ShellUser } from "@/components/app/ShellContext";
import { ConsentProvider } from "@/components/providers/consent-provider";
import { getActiveTutorSession, type ActiveTutorSession } from "@/lib/tutor-session";
import { getNotificationsSummary } from "./actions";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toShellUser(session: ActiveTutorSession | null): ShellUser | null {
  if (!session) return null;
  const user = session.user;
  return {
    tutorId: user.userId,
    displayName: asString(user.displayName) ?? asString(user.name),
    email: asString(user.email),
    avatarUrl: asString(user.profilePictureUrl) ?? asString(user.pictureUrl),
    verificationStatus: asString(user.verificationStatus),
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Independent requests run in parallel. getActiveTutorSession is memoised
  // per request (React cache), so pages calling it again don't refetch.
  const [session, notifications, cookieStore] = await Promise.all([
    getActiveTutorSession(),
    getNotificationsSummary(),
    cookies(),
  ]);
  const hasConsent =
    session?.user?.userConsents?.some(
      (c) => c.consentType === "TERMS_AND_PRIVACY" && c.status === "ACCEPTED",
    ) ?? false;

  return (
    <ConsentProvider hasConsent={hasConsent}>
      <AppShell
        user={toShellUser(session)}
        initialNotifications={notifications}
        sidebarCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "rail"}
      >
        {children}
      </AppShell>
    </ConsentProvider>
  );
}
