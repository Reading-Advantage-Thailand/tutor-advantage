"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Pencil, Plus, Video } from "lucide-react";
import { Sheet, TextField, toast } from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { updateMeetingUrl } from "../../actions";
import { PanelCard } from "./PanelCard";
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
    <PanelCard
      id="class-room-title"
      icon={Video}
      tone="blue"
      title={t("tutorClass.detail.onlineRoom")}
      description={initialUrl ? hostOf(initialUrl) : t("tutorClass.detail.missingMeetingUrl")}
      action={
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("tutorClass.detail.editLink")}
          onClick={() => {
            setUrl(initialUrl || "");
            setOpen(true);
          }}
        >
          <Pencil aria-hidden="true" />
        </Button>
      }
    >
      {initialUrl ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {/* Tonal: the page's one primary is the lesson picker's "สร้างห้องเรียน". */}
          <a
            id="btn-join-meeting"
            href={initialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "tonal", size: "lg" })}
          >
            {t("tutorClass.detail.enterRoom")}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={copied ? t("tutorClass.detail.copied") : t("tutorClass.ui.copyMeetingLink")}
            title={copied ? t("tutorClass.detail.copied") : t("tutorClass.detail.copy")}
            onClick={() => copy(initialUrl)}
          >
            {copied ? <CheckCircle2 aria-hidden="true" className="text-success-fg" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
      ) : (
        <Button variant="soft" size="lg" className="w-full" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
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
            <Button variant="outline" size="lg" className="md:h-10 md:px-4" onClick={() => setOpen(false)} disabled={loading}>
              {t("tutorClass.detail.cancel")}
            </Button>
            <Button size="lg" className="md:h-10 md:px-4" onClick={handleUpdate} loading={loading} disabled={!url}>
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
    </PanelCard>
  );
}
