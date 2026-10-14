"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/app";
import type { ResultsBarDatum } from "./ResultsBarChart";

export type { ResultsBarDatum };

/** recharts is ~90 KB gz: load it only when a results view is on screen. */
export const LazyResultsBarChart = dynamic(() => import("./ResultsBarChart"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
});

/** Start downloading the chart while students are still answering. */
export function preloadResultsChart() {
  void import("./ResultsBarChart").catch(() => undefined);
}
