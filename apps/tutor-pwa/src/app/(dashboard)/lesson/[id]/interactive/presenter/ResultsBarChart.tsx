"use client";

/**
 * recharts bar chart for question results. Loaded on demand through
 * LazyResultsBarChart (presenter/LazyResultsBarChart.tsx) so recharts/d3 are
 * not part of the presenter's first load.
 *
 * components.md §7: bars in --answer-*, the correct bar --success-solid plus
 * a check icon and a word above it (never colour alone), and a text summary
 * of every bar in the aria-label.
 */
import { CircleCheck } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { t } from "@/lib/i18n";

export interface ResultsBarDatum {
  name: string;
  count: number;
  fill: string;
  /** The right answer: labelled with a check icon and the word, not only the colour. */
  correct?: boolean;
}

const LABEL_WIDTH = 160;

export default function ResultsBarChart({
  data,
  maxBarSize = 72,
  tickSize = 18,
  correctLabel = t("lesson.interactive.correctPrefix"),
}: {
  data: ResultsBarDatum[];
  maxBarSize?: number;
  tickSize?: number;
  /** Word shown above the correct bar. */
  correctLabel?: string;
}) {
  const hasCorrect = data.some((entry) => entry.correct);
  const labelHeight = tickSize + 10;
  const summary = data
    .map((entry) => `${entry.name} ${entry.count}${entry.correct ? ` (${correctLabel})` : ""}`)
    .join(", ");

  const renderCorrectLabel = (props: { x?: unknown; y?: unknown; width?: unknown; value?: unknown }) => {
    const entry = data.find((item) => item.name === props.value);
    if (!entry?.correct) return null;
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width)) return null;
    return (
      <foreignObject x={x + width / 2 - LABEL_WIDTH / 2} y={y - labelHeight - 4} width={LABEL_WIDTH} height={labelHeight}>
        <div
          className="flex h-full items-center justify-center gap-1 leading-none font-semibold whitespace-nowrap text-success-fg"
          style={{ fontSize: tickSize }}
        >
          <CircleCheck aria-hidden="true" style={{ width: tickSize + 2, height: tickSize + 2 }} className="shrink-0" />
          {correctLabel}
        </div>
      </foreignObject>
    );
  };

  return (
    <div role="img" aria-label={summary} className="size-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: hasCorrect ? labelHeight + 8 : 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: tickSize, fontWeight: 700, fill: "var(--text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 13, fill: "var(--text-tertiary)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--hairline)",
              borderRadius: 12,
              fontSize: 14,
              color: "var(--text-primary)",
            }}
            cursor={{ fill: "var(--fill-muted)" }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={maxBarSize} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
            {hasCorrect ? <LabelList dataKey="name" content={renderCorrectLabel} /> : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
