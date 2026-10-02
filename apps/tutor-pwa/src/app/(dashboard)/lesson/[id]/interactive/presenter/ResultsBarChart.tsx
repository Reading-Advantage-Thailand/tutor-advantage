"use client";

/**
 * recharts bar chart for question results. Loaded on demand through
 * LazyResultsBarChart (presenter/LazyResultsBarChart.tsx) so recharts/d3 are
 * not part of the presenter's first load.
 */
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ResultsBarDatum {
  name: string;
  count: number;
  fill: string;
}

export default function ResultsBarChart({
  data,
  maxBarSize = 72,
  tickSize = 18,
}: {
  data: ResultsBarDatum[];
  maxBarSize?: number;
  tickSize?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
