"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Pencil, Video } from "lucide-react";
import { Card, CardHeader, IconTile, Sheet, TextField, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { updateMeetingUrl } from "../../actions";
import { useCopy } from "./useCopy";

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Online-room card: join / copy the meeting link and edit it in a sheet. */
export function MeetingUrlEditor({ classId, initialUrl }: { classId: string; initialUrl: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl || "");
  const [loading, setLoading] = useState(false);
  const { copied, copy } = useCopy();
  const router = useRouter();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateMeetingUrl(classId, url);
      setOpen(false);
      toast.success(t("tutorClass.ui.meetingSaved"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t("tutorClass.detail.updateMeetingFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card as="section" aria-labelledby="class-room-title">
      <CardHeader
        icon={<IconTile icon={Video} size="sm" tone="blue" />}
        title={<span id="class-room-title">{t("tutorClass.detail.onlineRoom")}</span>}
        description={initialUrl ? hostOf(initialUrl) : t("tutorClass.detail.missingMeetingUrl")}
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("tutorClass.detail.editLink")}
            onClick={() => {
              setUrl(initialUrl || "");
              setOpen(true);
            }}
          >
            <Pencil aria-hidden="true" />
          </Button>
        }
      />
      {initialUrl ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <a
            id="btn-join-meeting"
            href={initialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-solid px-3.5 text-sm font-semibold text-on-brand shadow-xs outline-none hover:bg-brand-solid-pressed focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-10"
          >
            {t("tutorClass.detail.enterRoom")}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <Button
            variant="outline"
            size="icon"
            aria-label={copied ? t("tutorClass.detail.copied") : t("tutorClass.ui.copyMeetingLink")}
            title={copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}
            onClick={() => copy(initialUrl)}
          >
            {copied ? <CheckCircle2 aria-hidden="true" className="text-success-fg" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
      ) : (
        <Button variant="soft" className="w-full" onClick={() => setOpen(true)}>
          {t("tutorClass.ui.addMeetingLink")}
        </Button>
      )}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("tutorClass.detail.editMeetingTitle")}
        description={t("tutorClass.detail.editMeetingDescription")}
        dismissible={!loading}
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" size="lg" className="md:h-9" onClick={() => setOpen(false)} disabled={loading}>
              {t("tutorClass.detail.cancel")}
            </Button>
            <Button size="lg" className="md:h-9" onClick={handleUpdate} loading={loading} disabled={!url}>
              {loading ? t("tutorClass.detail.saving") : t("tutorClass.detail.save")}
            </Button>
          </div>
        }
      >
        <TextField
          id="url"
          type="url"
          inputMode="url"
          label={t("tutorClass.detail.meetingUrlLabel")}
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Sheet>
    </Card>
  );
}
