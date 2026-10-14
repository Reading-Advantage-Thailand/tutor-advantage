/**
 * @deprecated The old sidebar (with its own 10 s notification poller) is gone.
 * The dashboard uses <AppShell> from "@/components/app"; lesson routes use
 * <LessonShell>, which deliberately has no navigation. This shim renders
 * nothing so the live-lesson lobby (LobbyClient, owned by G6) still compiles;
 * G6 should delete its <Sidebar/> wrapper and the `xl:ml-72` offsets.
 */
export function Sidebar(): null {
  return null;
}
