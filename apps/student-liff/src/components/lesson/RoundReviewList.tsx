import type { RoundReview } from "../../lib/games/lessonGameResult";

/** The words a student should read again, on the result card that stays up until the tutor moves on. */
export function RoundReviewList({ review }: { review?: RoundReview }) {
  if (!review || review.missed.length === 0) return null;
  return (
    <div data-testid="round-review" className="mt-3 rounded-2xl bg-surface px-3 py-2 text-left">
      <p className="text-[13px] leading-[1.5] font-bold text-fg">ทบทวนคำเหล่านี้</p>
      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
        {review.missed.map((word) => (
          <li key={word.term} className="text-[13px] leading-[1.5] text-fg">
            <span className="font-bold">{word.term}</span> = {word.meaning}
          </li>
        ))}
      </ul>
    </div>
  );
}
