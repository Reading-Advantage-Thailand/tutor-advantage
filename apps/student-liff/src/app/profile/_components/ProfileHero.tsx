import type { ReactNode } from "react";
import { UserAvatar } from "@/components/mobile";
import { t } from "@/lib/i18n";

export interface ProfileHeroProps {
  name: string;
  pictureUrl?: string | null;
  /** The level chip (or its skeleton) under the name; nothing when there is no level. */
  level?: ReactNode;
}

/**
 * Tab-root header for Profile (patterns.md S10): the flat student hero with
 * its two blobs, the page title (the screen's one h1), then avatar 72 with a
 * card ring, the name and the level chip. Server-compatible.
 */
export function ProfileHero({ name, pictureUrl, level }: ProfileHeroProps) {
  return (
    <header className="hero-surface px-4 pt-[calc(var(--safe-top)+20px)] pb-7">
      <h1 className="t-display">{t("profile.title")}</h1>
      <div className="mt-4 flex items-center gap-4">
        <UserAvatar src={pictureUrl} name={name} size="profile" ring="surface" decorative />
        <div className="min-w-0 flex-1">
          <h2 className="t-title-l break-words text-balance">{name}</h2>
          {level ? <div className="mt-2 flex flex-wrap gap-2">{level}</div> : null}
        </div>
      </div>
    </header>
  );
}
