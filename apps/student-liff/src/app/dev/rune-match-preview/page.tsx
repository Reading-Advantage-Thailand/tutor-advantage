import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { RuneMatchPreview } from "./RuneMatchPreview";

/** Dev QA page: 404 in production and whenever ENABLE_DEV_ROUTES is not "true". */
export default function RuneMatchPreviewPage() {
  if (!devRoutesEnabled()) notFound();
  return <RuneMatchPreview />;
}
