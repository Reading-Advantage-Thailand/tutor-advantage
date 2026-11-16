import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { buildSweepInventory } from "./sweepInventory";
import { UiKitGallery } from "./UiKitGallery";

export const metadata: Metadata = {
  title: "ชุดคอมโพเนนต์ (dev)",
  robots: { index: false, follow: false },
};

/**
 * Dev-only gallery of the admin design system (src/components/app + the
 * restyled src/components/ui), every component in a light and a dark pane
 * with real fixtures, plus the redesign sweep inventory generated from the
 * source tree. Gated by the middleware (devOnly route, ADMIN) and here:
 * NODE_ENV !== production and ENABLE_DEV_ROUTES=true.
 * Optional ?section=<id> renders one section only.
 */
export default async function UiKitPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  if (!devRoutesEnabled()) notFound();
  const { section } = await searchParams;
  const inventory = !section || section === "sweep" ? buildSweepInventory() : null;
  return <UiKitGallery only={section} inventory={inventory} />;
}
