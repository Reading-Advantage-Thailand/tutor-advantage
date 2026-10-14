"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice, Sheet } from "@/components/app";
import { t } from "@/lib/i18n";
import { getMissingTawi50Fields, type Tawi50RequiredSettings } from "@/lib/tawi50Requirements";

type Tawi50DownloadButtonProps = {
  href: string;
  filename: string;
  settings: Tawi50RequiredSettings | null;
  isVerified: boolean;
};

/**
 * Downloads the 50 ทวิ PDF. The PDF is generated server-side by
 * /api/documents/tawi50 (pdf libs load there only on demand), so this
 * button ships no PDF code to the browser.
 */
export function Tawi50DownloadButton({ href, filename, settings, isVerified }: Tawi50DownloadButtonProps) {
  const router = useRouter();
  const [showMissingFields, setShowMissingFields] = useState(false);
  const missingFields = getMissingTawi50Fields(settings);

  const handleClick = () => {
    if (missingFields.length === 0 && isVerified) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    setShowMissingFields(true);
  };

  const goToFinanceSettings = () => {
    setShowMissingFields(false);
    router.push("/dashboard/settings#verify");
  };

  return (
    <>
      <Button type="button" variant="soft" size="xs" onClick={handleClick}>
        <FileDown aria-hidden="true" />
        {t("dashboardEarnings.tawi50Short")}
      </Button>

      <Sheet
        open={showMissingFields}
        onOpenChange={setShowMissingFields}
        title={t("dashboardEarnings.tawi50Blocked.title")}
        description={t("dashboardEarnings.tawi50Blocked.description")}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowMissingFields(false)}>
              {t("shell.close")}
            </Button>
            <Button onClick={goToFinanceSettings}>{t("dashboardEarnings.tawi50Blocked.goFill")}</Button>
          </>
        }
      >
        <Notice tone="warning" title={t("dashboardEarnings.tawi50Blocked.missingTitle")}>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {!isVerified ? <li>{t("dashboardEarnings.tawi50Blocked.notVerified")}</li> : null}
            {missingFields.map((field) => (
              <li key={field.key}>{field.label}</li>
            ))}
          </ul>
        </Notice>
      </Sheet>
    </>
  );
}
