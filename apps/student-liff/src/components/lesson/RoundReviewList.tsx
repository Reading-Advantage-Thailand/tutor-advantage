import type { RoundReview } from "../../lib/games/lessonGameResult";

/** The words a student should read again, on the result card that stays up until the tutor moves on. */
export function RoundReviewList({ review }: { review?: RoundReview }) {
  if (!review || review.missed.length === 0) return null;
  return (
    <div data-testid="round-review" className="mt-3 rounded-lg bg-surface px-3.5 py-3 text-left">
      <p className="text-[13px] leading-[1.5] font-semibold text-fg">ทบทวนคำเหล่านี้</p>
      <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
        {review.missed.map((word) => (
          <li key={word.term} className="text-sm leading-[1.6] text-fg">
            <span lang="en" className="font-semibold">{word.term}</span> = {word.meaning}
          </li>
        ))}
      </ul>
    </div>
  );
}
