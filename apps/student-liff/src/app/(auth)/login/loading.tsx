import { t } from "@/lib/i18n";
import { BrandSplash } from "../../_components/BrandSplash";

/** Same splash the page shows while LIFF starts, so navigation never flashes. */
export default function LoginLoading() {
  return <BrandSplash label={t("app.preparingLogin")} />;
}
