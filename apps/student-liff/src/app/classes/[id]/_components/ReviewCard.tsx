"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { toast } from "sonner";
import { Chip, IconTile, Skeleton, Surface, TextArea } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TutorReview } from "./types";

const STARS = [1, 2, 3, 4, 5] as const;

function ReviewForm({
  classId,
  review,
  onSaved,
}: {
  classId: string;
  review: TutorReview | null;
  onSaved: (review: TutorReview) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) {
      toast.error(t("classes.detail.reviewSelectStarFirst"));
      return;
    }
    setSubmitting(true);
    try {
      const data = await studentApi.submitClassReview(classId, {
        rating,
        comment: comment.trim() || undefined,
      });
      onSaved(data.review);
      setEditing(false);
      toast.success(t("classes.detail.reviewSaveSuccess"));
    } catch {
      toast.error(t("classes.detail.reviewSaveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (review && !editing) {
    return (
      <div className="flex flex-col gap-3">
        <Chip tone="success" icon={CheckCircle2} className="self-start">
          {t("classes.detail.reviewed")}
        </Chip>
        <div
          className="flex gap-1.5"
          role="img"
          aria-label={`${t("classes.detail.reviewStarPrefix")} ${review.rating} ${t("classes.detail.reviewStarSuffix")}`}
        >
          {STARS.map((value) => (
            <Star
              key={value}
              aria-hidden="true"
              className={cn(
                "size-6",
                value <= review.rating ? "fill-warning-solid text-warning-solid" : "text-fg-subtle",
              )}
            />
          ))}
        </div>
        {review.comment ? <p className="text-sm leading-[1.6] text-fg-muted">{review.comment}</p> : null}
        <Button variant="outline" size="touch" className="self-start" onClick={() => setEditing(true)}>
          {t("classes.detail.editReview")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {STARS.map((value) => {
          const active = value <= rating;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${t("classes.detail.reviewStarPrefix")} ${value} ${t("classes.detail.reviewStarSuffix")}`}
              aria-pressed={value === rating}
              className={cn(
                "pressable flex size-12 items-center justify-center rounded-2xl border",
                active ? "border-warning-border bg-warning-bg text-warning-solid" : "border-hairline bg-surface text-fg-subtle",
              )}
            >
              <Star aria-hidden="true" className={cn("size-6", active && "fill-current")} />
            </button>
          );
        })}
      </div>

      <TextArea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={t("classes.detail.reviewPlaceholder")}
        aria-label={t("classes.detail.reviewTitle")}
        maxLength={500}
        textareaClassName="min-h-[96px]"
      />

      <div className="flex gap-3">
        {editing && review ? (
          <Button
            variant="outline"
            size="cta"
            className="flex-1"
            onClick={() => {
              setRating(review.rating);
              setComment(review.comment ?? "");
              setEditing(false);
            }}
          >
            {t("classes.detail.reviewCancel")}
          </Button>
        ) : null}
        <Button
          variant="brand"
          size="cta"
          className="flex-1"
          onClick={handleSubmit}
          disabled={rating === 0}
          loading={submitting}
        >
          {submitting
            ? t("classes.detail.reviewSaving")
            : editing
              ? t("classes.detail.reviewSaveEdits")
              : t("classes.detail.reviewSubmit")}
        </Button>
      </div>
    </div>
  );
}

/** "Rate your teacher" card for enrolled students of a closed class. */
export function ReviewCard({
  classId,
  review,
  loading,
  onSaved,
}: {
  classId: string;
  review: TutorReview | null;
  loading: boolean;
  onSaved: (review: TutorReview) => void;
}) {
  return (
    <Surface tone="warning" padding="lg">
      <div className="flex items-start gap-3">
        <IconTile icon={Star} tone="amber" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base leading-[1.5] font-bold text-fg">{t("classes.detail.reviewTitle")}</h3>
          <p className="mt-0.5 text-[13px] leading-[1.6] text-fg-muted">{t("classes.detail.reviewDescription")}</p>
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="flex gap-1.5" aria-hidden="true">
            {STARS.map((value) => (
              <Skeleton key={value} className="size-12 rounded-2xl" />
            ))}
          </div>
        ) : (
          // Re-mount when a review appears/changes so the form starts from it.
          <ReviewForm key={review?.id ?? "new"} classId={classId} review={review} onSaved={onSaved} />
        )}
      </div>
    </Surface>
  );
}
