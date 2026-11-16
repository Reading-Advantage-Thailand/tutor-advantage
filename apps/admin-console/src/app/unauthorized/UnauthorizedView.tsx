"use client";

import { ArrowLeft, Home, LogOut, ShieldX } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { logout, PublicFrame, StatusScreen } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { keepRoleTerms } from "../login/keepRoleTerms";
import "@/locales/th/unauthorized";

/**
 * "คุณเข้าสู่ระบบเป็น {name} ({role}) …" with the role kept on one line
 * ("(ผู้ดูแลระบบ)" never splits into "(ผู้ดูแล" / "ระบบ)"), the same role terms
 * in the rest of the sentence too (keepRoleTerms), and a long name or email
 * broken anywhere so it wraps inside the card.
 */
const NAME_SLOT = "\u0001";
const ROLE_SLOT = "\u0002";

function SignedInDescription({ name, role }: { name: string; role: string }) {
  const text = t("unauthorized.signedInDescription", { name: NAME_SLOT, role: ROLE_SLOT });
  return (
    <>
      {text.split(new RegExp(`(${NAME_SLOT}|${ROLE_SLOT})`)).map((part, index) =>
        part === NAME_SLOT ? (
          <span key={index} className="[overflow-wrap:anywhere]">
            {name}
          </span>
        ) : part === ROLE_SLOT ? (
          <span key={index} className="whitespace-nowrap">
            {role}
          </span>
        ) : (
          <Fragment key={index}>{keepRoleTerms(part)}</Fragment>
        ),
      )}
    </>
  );
}

export function UnauthorizedView({ session }: { session: { name: string; role: string } | null }) {
  const [leaving, setLeaving] = useState(false);
  const signOut = () => {
    setLeaving(true);
    void logout();
  };

  return (
    <PublicFrame>
      <StatusScreen
        icon={ShieldX}
        tone="red"
        title={session ? t("unauthorized.signedInTitle") : t("unauthorized.signedOutTitle")}
        description={
          <span className="break-words">
            {session ? (
              <SignedInDescription name={session.name} role={session.role} />
            ) : (
              keepRoleTerms(t("unauthorized.signedOutDescription"))
            )}
          </span>
        }
        actions={
          session ? (
            <>
              <Button asChild size="lg" className="w-full">
                <Link href="/">
                  <Home aria-hidden="true" />
                  {t("unauthorized.goHome")}
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={signOut} loading={leaving}>
                {leaving ? null : <LogOut aria-hidden="true" />}
                {leaving ? t("unauthorized.loggingOut") : t("unauthorized.switchAccount")}
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="w-full">
                <Link href="/login">
                  <ArrowLeft aria-hidden="true" />
                  {t("unauthorized.backLogin")}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full">
                <a href="https://lin.ee/R7Dccj9" target="_blank" rel="noopener noreferrer">
                  {t("unauthorized.contactSupport")}
                </a>
              </Button>
            </>
          )
        }
      />
    </PublicFrame>
  );
}
