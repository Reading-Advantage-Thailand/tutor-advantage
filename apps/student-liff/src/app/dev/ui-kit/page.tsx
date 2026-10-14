import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { UiKitGallery } from "./UiKitGallery";

export const metadata: Metadata = {
  title: "UI kit (dev) - Tutor Advantage",
  robots: "noindex, nofollow",
};

/**
 * Dev-only visual QA gallery for the mobile design system.
 * Reachable only when devRoutesEnabled() (NODE_ENV !== "production" and
 * ENABLE_DEV_ROUTES=true); 404 everywhere else.
 */
export default function UiKitPage() {
  if (!devRoutesEnabled()) notFound();
  return <UiKitGallery />;
}
