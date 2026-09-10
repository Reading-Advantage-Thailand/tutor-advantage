import answerKeyData from "./assessment-answer-keys.v1.json";
import type { AssessmentQuestion } from "@tutor-advantage/shared-config";

export type AssessmentStage = "PRE" | "POST";
type Skill = AssessmentQuestion["skill"];
type AnswerKey = {
  version: string;
  answers: Record<AssessmentStage, Record<string, number>>;
};
type AnswerKeyCatalog = {
  schemaVersion: number;
  bankVersion: string;
  articles: Record<string, AnswerKey>;
};
type PublicManifest = {
  schemaVersion: number;
  bankVersion: string;
  version: string;
  articleId: string;
  title: string;
  readingPassage: string;
  forms: Record<AssessmentStage, AssessmentQuestion[]>;
};
export type ArticleAssessment = {
  articleId: string;
  title: string;
  version: string;
  forms: Record<AssessmentStage, AssessmentQuestion[]>;
  answers: Record<AssessmentStage, Record<string, number>>;
};

const answerKeys = answerKeyData as AnswerKeyCatalog;
const cache = new Map<string, Promise<ArticleAssessment>>();
const skills = new Set<Skill>(["vocabulary", "reading", "listening"]);

function bucketName() {
  return process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "tutor_advantage_bucket";
}

function manifestUrl(articleId: string, version: string) {
  return `https://storage.googleapis.com/${encodeURIComponent(bucketName())}/assessments/articles/${encodeURIComponent(articleId)}/${encodeURIComponent(version)}.json`;
}

function validateManifest(value: unknown, articleId: string, answerKey: AnswerKey): PublicManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Assessment manifest is not an object");
  const manifest = value as PublicManifest;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.bankVersion !== answerKeys.bankVersion ||
    manifest.articleId !== articleId ||
    manifest.version !== answerKey.version ||
    typeof manifest.title !== "string" ||
    typeof manifest.readingPassage !== "string"
  ) throw new Error("Assessment manifest metadata is invalid");

  for (const stage of ["PRE", "POST"] as const) {
    const form = manifest.forms?.[stage];
    if (!Array.isArray(form) || form.length !== 15) throw new Error(`Assessment ${stage} form is invalid`);
    const ids = new Set<string>();
    const skillCounts: Record<Skill, number> = { vocabulary: 0, reading: 0, listening: 0 };
    for (const item of form) {
      if (
        !item ||
        typeof item.id !== "string" ||
        ids.has(item.id) ||
        !skills.has(item.skill) ||
        typeof item.prompt !== "string" ||
        !Array.isArray(item.options) ||
        item.options.length !== 4 ||
        item.options.some((option) => typeof option !== "string")
      ) throw new Error(`Assessment item ${item?.id || "unknown"} is invalid`);
      if (item.skill === "listening" && (typeof item.audioUrl !== "string" || !item.audioUrl.startsWith("https://"))) {
        throw new Error(`Assessment listening item ${item.id} has no bucket audio URL`);
      }
      const answer = answerKey.answers?.[stage]?.[item.id];
      if (!Number.isInteger(answer) || answer < 0 || answer >= item.options.length) {
        throw new Error(`Assessment answer key ${item.id} is invalid`);
      }
      ids.add(item.id);
      skillCounts[item.skill]++;
    }
    if (Object.values(skillCounts).some((count) => count !== 5)) throw new Error(`Assessment ${stage} blueprint is invalid`);
  }
  return manifest;
}

export function hasArticleAssessment(articleId: string) {
  return Boolean(articleId && answerKeys.articles[articleId]);
}

export function assessmentArticleIds() {
  return new Set(Object.keys(answerKeys.articles));
}

export async function loadArticleAssessment(articleId: string): Promise<ArticleAssessment> {
  const answerKey = answerKeys.articles[articleId];
  if (!answerKey) throw new Error(`No assessment bank exists for article ${articleId}`);
  const key = `${bucketName()}:${articleId}:${answerKey.version}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(manifestUrl(articleId, answerKey.version), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Assessment manifest request failed with HTTP ${response.status}`);
    const manifest = validateManifest(await response.json(), articleId, answerKey);
    const forms = Object.fromEntries(
      (["PRE", "POST"] as const).map((stage) => [stage, manifest.forms[stage].map((item) => ({
        ...item,
        ...(item.skill === "reading" ? { passage: manifest.readingPassage } : {}),
      }))]),
    ) as Record<AssessmentStage, AssessmentQuestion[]>;
    return { articleId, title: manifest.title, version: manifest.version, forms, answers: answerKey.answers };
  })();
  cache.set(key, request);
  request.catch(() => cache.delete(key));
  return request;
}

export function gradeArticleAssessment(bank: ArticleAssessment, stage: AssessmentStage, answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("คำตอบไม่ครบหรือรูปแบบไม่ถูกต้อง");
  const submitted = answers as Record<string, unknown>;
  const form = bank.forms[stage];
  if (Object.keys(submitted).length !== form.length) throw new Error("คำตอบไม่ครบหรือรูปแบบไม่ถูกต้อง");
  const scores: Record<Skill, number> = { vocabulary: 0, reading: 0, listening: 0 };
  const validated: Record<string, number> = {};
  for (const item of form) {
    const choice = submitted[item.id];
    if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) >= item.options.length) {
      throw new Error("คำตอบไม่ครบหรือรูปแบบไม่ถูกต้อง");
    }
    validated[item.id] = choice as number;
    if (choice === bank.answers[stage][item.id]) scores[item.skill]++;
  }
  return { answers: validated, scores, total: Object.values(scores).reduce((sum, score) => sum + score, 0) };
}
