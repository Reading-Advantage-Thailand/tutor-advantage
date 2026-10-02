import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { UiKitGallery } from "./UiKitGallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UI kit (dev) - Tutor Advantage",
  robots: { index: false, follow: false },
};

/**
 * Dev-only gallery of the tutor design system (src/components/app + restyled
 * src/components/ui). Gated like the other dev routes: NODE_ENV !== production
 * and ENABLE_DEV_ROUTES=true. Optional ?section=<id> renders one section only.
 */
export default async function UiKitPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  if (!devRoutesEnabled()) notFound();
  const { section } = await searchParams;
  return <UiKitGallery only={section} />;
}
