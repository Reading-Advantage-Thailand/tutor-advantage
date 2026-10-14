import { notFound } from "next/navigation";
import { devRoutesEnabled } from "@/lib/security";
import { ArcadePreview } from "./ArcadePreview";

/** Dev QA page: 404 in production and whenever ENABLE_DEV_ROUTES is not "true". */
export default function ArcadePreviewPage() {
  if (!devRoutesEnabled()) notFound();
  return <ArcadePreview />;
}
