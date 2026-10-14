import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { UiKitGallery } from "./UiKitGallery";

export const metadata: Metadata = {
  title: "ชุดคอมโพเนนต์ (dev)",
  robots: { index: false, follow: false },
};

/**
 * Dev-only gallery of the admin design system (src/components/app + the
 * restyled src/components/ui). Gated by the middleware (devOnly route, ADMIN)
 * and here: NODE_ENV !== production and ENABLE_DEV_ROUTES=true.
 * Optional ?section=<id> renders one section only.
 */
export default async function UiKitPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  if (!devRoutesEnabled()) notFound();
  const { section } = await searchParams;
  return <UiKitGallery only={section} />;
}
