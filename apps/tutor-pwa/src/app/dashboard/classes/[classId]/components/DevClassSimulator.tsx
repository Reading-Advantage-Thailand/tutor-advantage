"use client";

import { useState } from "react";
import { FlaskConical, Users2 } from "lucide-react";
import { Card, CardHeader, IconTile, Notice } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { devSeedClassAllProgress } from "../../actions";

type SeedResult = {
  className: string;
  bookTitle: string;
  studentsProcessed: number;
  articlesTotal: number;
  sessionsCreated: number;
  skipped: number;
};

// ─── DEV ONLY ─────────────────────────────────────────────────────────────────
// Completes all lessons for every enrolled student in one click: useful for
// testing the upclass flow. Rendered only when NODE_ENV === "development".
export function DevClassSimulator({ classId }: { classId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      setResult(await devSeedClassAllProgress(classId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card as="section" className="border-dashed border-warning-border">
      <CardHeader
        icon={<IconTile icon={FlaskConical} size="sm" tone="amber" />}
        title={t("tutorClass.dev.simulatorTitle")}
        description={t("tutorClass.dev.simulatorDescription")}
      />
      <Button variant="outline" onClick={handleSeed} loading={loading}>
        {loading ? null : <Users2 aria-hidden="true" />}
        {loading ? t("tutorClass.dev.seeding") : t("tutorClass.dev.seed")}
      </Button>
      {result ? (
        <Notice tone="success" title={`${t("tutorClass.dev.done")} ${result.className}`} className="mt-3">
          {result.bookTitle} · {t("tutorClass.dev.students")} {result.studentsProcessed} · {t("tutorClass.dev.sessionsCreated")}{" "}
          {result.sessionsCreated} · {t("tutorClass.dev.skipped")} {result.skipped}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" className="mt-3" role="alert">
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}
