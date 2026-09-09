#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Storage } from "@google-cloud/storage";
import { Pool } from "pg";

const ROOT = process.cwd();
const BANK_VERSION = "article-assessments-v1";
const CATALOG_PATH = path.join(ROOT, "packages", "database", "catalog-157-articles.json");
const TTS_DIR = path.join(ROOT, "packages", "database", "tts-manifests");
const PUBLIC_DIR = path.join(ROOT, "packages", "database", "assessment-manifests", "public");
const ANSWER_KEY_PATH = path.join(
  ROOT,
  "services",
  "learning-service",
  "src",
  "services",
  "assessment-answer-keys.v1.json",
);
const DEFAULT_PRIMARY_WORKBOOKS = "C:/Repository/advantage-workbooks/primary";

function loadDotEnv() {
  try {
    for (const line of readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // CI may provide the environment directly.
  }
}

loadDotEnv();

const args = new Set(process.argv.slice(2));
const shouldUpload = args.has("--upload");
const validateOnly = args.has("--validate-only");
const bucketName = process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket";

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalized(value) {
  return text(value)
    .replace(/^[A-D][.)]\s*/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, " ")
    .trim();
}

function uniqueBy(values, keyOf) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyOf(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function digest(value, length = 12) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function seededShuffle(values, seed) {
  return values
    .map((value, index) => ({ value, rank: digest(`${seed}\0${index}\0${JSON.stringify(value)}`, 16) }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(({ value }) => value);
}

function cycleTake(values, count, offset = 0) {
  if (!values.length) return [];
  return Array.from({ length: count }, (_, index) => values[(offset + index) % values.length]);
}

function sourceKind(source) {
  return text(source).toLowerCase().includes("primary") ? "primary" : "reading";
}

function articleText(sentence) {
  return text(sentence?.text ?? sentence?.sentences ?? sentence?.sentence ?? sentence);
}

function splitSentences(value) {
  return text(value).match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map(text).filter(Boolean) || [];
}

function vocabularyOf(value) {
  const word = text(value?.vocabulary ?? value?.word ?? value?.text);
  const thai = text(value?.definition?.th ?? value?.thai_definition ?? value?.translation);
  const english = text(value?.definition?.en ?? value?.definition);
  return word && thai ? { word, thai, english } : null;
}

function answerIndex(question) {
  const options = (Array.isArray(question.options) ? question.options : Object.values(question.options || {}))
    .map((option) => text(option).replace(/^[A-D][.)]\s*/i, ""));
  const answer = normalized(question.answer);
  const correct = options.findIndex((option) => {
    const candidate = normalized(option);
    return candidate === answer || candidate.includes(answer) || answer.includes(candidate);
  });
  if (options.length < 2 || correct < 0) {
    throw new Error(`Cannot resolve answer for: ${question.question}`);
  }
  return { options, correct };
}

async function primaryDatabaseUrl() {
  if (process.env.DATABASE_URL_PRIMARY_ADVANTAGE) return process.env.DATABASE_URL_PRIMARY_ADVANTAGE;
  const envPath = process.env.PRIMARY_ADVANTAGE_ENV_FILE || "C:/Repository/primary-advantage/.env";
  const env = await readFile(envPath, "utf8");
  const line = env.split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL is missing from ${envPath}`);
  return line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
}

async function loadWorkbookFallbacks() {
  const root = path.resolve(process.env.PRIMARY_WORKBOOKS_DIR || DEFAULT_PRIMARY_WORKBOOKS);
  const result = new Map();
  for (const directory of await readdir(root, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const directoryPath = path.join(root, directory.name);
    for (const file of await readdir(directoryPath)) {
      if (!file.endsWith("_workbook.json")) continue;
      const workbook = JSON.parse(await readFile(path.join(directoryPath, file), "utf8"));
      const key = normalized(workbook.lesson_title);
      if (!result.has(key)) result.set(key, workbook);
    }
  }
  return result;
}

async function queryReading(ids) {
  const connectionString = process.env.DATABASE_URL_READING_ADVANTAGE || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_READING_ADVANTAGE is not configured");
  const pool = new Pool({ connectionString });
  try {
    const [articles, questions] = await Promise.all([
      pool.query(
        'SELECT id, title, cefr_level, words, sentences FROM "article" WHERE id = ANY($1)',
        [ids],
      ),
      pool.query(
        'SELECT article_id, question, options, answer FROM "MultipleChoiceQuestion" WHERE article_id = ANY($1) ORDER BY "createdAt", id',
        [ids],
      ),
    ]);
    return { articles: articles.rows, questions: questions.rows };
  } finally {
    await pool.end();
  }
}

async function queryPrimary(ids) {
  const pool = new Pool({ connectionString: await primaryDatabaseUrl() });
  try {
    const [articles, questions] = await Promise.all([
      pool.query(
        `SELECT a.id, a.title, a.sentences, COALESCE(a.words, flash.words, '[]'::jsonb) AS words
         FROM article a
         LEFT JOIN LATERAL (
           SELECT words FROM sentencs_and_words_for_flashcard
           WHERE article_id = a.id LIMIT 1
         ) flash ON TRUE
         WHERE a.id = ANY($1) AND a.is_published = true`,
        [ids],
      ),
      pool.query(
        "SELECT article_id, question, options, answer FROM multiple_choice_questions WHERE article_id = ANY($1) ORDER BY id",
        [ids],
      ),
    ]);
    return { articles: articles.rows, questions: questions.rows };
  } finally {
    await pool.end();
  }
}

async function loadSourceArticles(catalog) {
  const unique = new Map();
  for (const item of catalog) {
    const articleId = text(item.articleId);
    if (!articleId) continue;
    const existing = unique.get(articleId);
    if (existing) {
      if (!existing.bookLabels.includes(item.source)) existing.bookLabels.push(item.source);
      continue;
    }
    unique.set(articleId, {
      articleId,
      title: text(item.title),
      source: sourceKind(item.source),
      bookLabels: [text(item.source)],
      catalogWords: item.words || [],
    });
  }

  const readingIds = [...unique.values()].filter((item) => item.source === "reading").map((item) => item.articleId);
  const primaryIds = [...unique.values()].filter((item) => item.source === "primary").map((item) => item.articleId);
  const [reading, primary, workbooks] = await Promise.all([
    queryReading(readingIds),
    queryPrimary(primaryIds),
    loadWorkbookFallbacks(),
  ]);
  const articleRows = new Map([...reading.articles, ...primary.articles].map((row) => [row.id, row]));
  const questionRows = new Map();
  for (const question of [...reading.questions, ...primary.questions]) {
    const items = questionRows.get(question.article_id) || [];
    items.push(question);
    questionRows.set(question.article_id, items);
  }

  const result = [];
  for (const item of unique.values()) {
    const row = articleRows.get(item.articleId);
    const workbook = workbooks.get(normalized(item.title));
    const ttsPath = path.join(TTS_DIR, `${item.source}-${item.articleId}.json`);
    const tts = JSON.parse(await readFile(ttsPath, "utf8"));
    let questions = questionRows.get(item.articleId) || [];
    if (!questions.length && workbook) {
      const answers = new Map((workbook.mc_answers || []).map((answer) => [Number(answer.number), answer.text]));
      questions = (workbook.comprehension_questions || []).map((question) => ({
        question: question.question,
        options: question.options,
        answer: answers.get(Number(question.number)),
      }));
    }
    if (questions.length < 5) {
      questions.push({
        question: "What is the title of this article?",
        options: seededShuffle([item.title, ...[...unique.values()].filter((other) => other.articleId !== item.articleId).slice(0, 3).map((other) => other.title)], `${item.articleId}:title`),
        answer: item.title,
      });
    }
    const rawWords = row?.words?.length ? row.words : item.catalogWords;
    const vocabulary = uniqueBy(rawWords.map(vocabularyOf).filter(Boolean), (word) => normalized(word.word));
    const ttsAudioByText = new Map((tts.sentences || []).map((sentence) => [normalized(articleText(sentence)), text(sentence.audioUrl)]));
    let sourceSentences = Array.isArray(row?.sentences) ? row.sentences.map(articleText).filter(Boolean) : [];
    if (!sourceSentences.length && workbook?.article_paragraphs) {
      sourceSentences = workbook.article_paragraphs.flatMap((paragraph) => splitSentences(paragraph.text));
    }
    const sentences = uniqueBy(sourceSentences.map((sentence) => ({
      text: sentence,
      audioUrl: ttsAudioByText.get(normalized(sentence)) || null,
    })), (sentence) => normalized(sentence.text));
    result.push({
      ...item,
      title: text(row?.title) || item.title,
      cefrLevel: text(row?.cefr_level) || text(workbook?.cefr_level) || null,
      vocabulary,
      questions,
      sentences,
    });
  }
  return result;
}

function distractorsFor(word, article, pool, field, seed) {
  const preferred = pool.filter((candidate) =>
    candidate.articleId !== article.articleId &&
    candidate.bookLabels.some((label) => article.bookLabels.includes(label)),
  );
  const candidates = uniqueBy(
    [...article.vocabulary, ...preferred.flatMap((candidate) => candidate.vocabulary), ...pool.flatMap((candidate) => candidate.vocabulary)]
      .filter((candidate) => normalized(candidate[field]) !== normalized(word[field])),
    (candidate) => normalized(candidate[field]),
  );
  return seededShuffle(candidates, seed).slice(0, 3).map((candidate) => candidate[field]);
}

function buildVocabularyItems(article, pool, stage) {
  if (!article.vocabulary.length) throw new Error(`${article.articleId} has no usable vocabulary`);
  const offset = stage === "PRE" ? 0 : Math.min(5, article.vocabulary.length - 1);
  return cycleTake(article.vocabulary, 5, offset).map((word, index) => {
    const reverse = (index + (stage === "POST" ? 1 : 0)) % 2 === 1;
    const id = `${stage.toLowerCase()}-v${index + 1}`;
    const field = reverse ? "word" : "thai";
    const options = seededShuffle(
      [word[field], ...distractorsFor(word, article, pool, field, `${article.articleId}:${id}:distractors`)],
      `${article.articleId}:${id}:options`,
    );
    if (options.length !== 4) throw new Error(`${article.articleId} cannot build four vocabulary options`);
    return {
      public: {
        id,
        skill: "vocabulary",
        prompt: reverse
          ? `คำภาษาอังกฤษข้อใดมีความหมายว่า “${word.thai}”?`
          : `คำว่า “${word.word}” หมายถึงอะไร?`,
        options,
      },
      correct: options.findIndex((option) => normalized(option) === normalized(word[field])),
    };
  });
}

function buildReadingItems(article, stage) {
  const source = article.questions.length >= 10
    ? article.questions.slice(stage === "PRE" ? 0 : 5, stage === "PRE" ? 5 : 10)
    : cycleTake(article.questions, 5, stage === "PRE" ? 0 : 1);
  return source.map((question, index) => {
    const resolved = answerIndex(question);
    const id = `${stage.toLowerCase()}-r${index + 1}`;
    const correctText = resolved.options[resolved.correct];
    const padded = [...resolved.options];
    for (const fallback of ["The story does not say.", "None of these."]) {
      if (padded.length >= 4) break;
      if (!padded.some((option) => normalized(option) === normalized(fallback))) padded.push(fallback);
    }
    const fourOptions = padded.length > 4
      ? [correctText, ...padded.filter((option) => normalized(option) !== normalized(correctText)).slice(0, 3)]
      : padded;
    const options = seededShuffle(fourOptions, `${article.articleId}:${id}:options`);
    return {
      public: { id, skill: "reading", prompt: text(question.question), options },
      correct: options.findIndex((option) => normalized(option) === normalized(correctText)),
    };
  });
}

function buildListeningItems(article, pool, stage) {
  const candidates = article.sentences.filter((sentence) => sentence.text.split(/\s+/).length >= 3 && sentence.text.length <= 180);
  const usable = candidates.length >= 10 ? candidates : article.sentences;
  if (!usable.length) throw new Error(`${article.articleId} has no listening sentences`);
  const ordered = seededShuffle(usable, `${article.articleId}:listening-order`);
  return cycleTake(ordered, 5, stage === "PRE" ? 0 : 5).map((sentence, index) => {
    const id = `${stage.toLowerCase()}-l${index + 1}`;
    const nearby = pool.filter((candidate) =>
      candidate.articleId !== article.articleId &&
      candidate.bookLabels.some((label) => article.bookLabels.includes(label)),
    ).flatMap((candidate) => candidate.sentences);
    const distractors = seededShuffle(
      uniqueBy([...usable, ...nearby].filter((candidate) => normalized(candidate.text) !== normalized(sentence.text)), (candidate) => normalized(candidate.text)),
      `${article.articleId}:${id}:distractors`,
    ).slice(0, 3).map((candidate) => candidate.text);
    const options = seededShuffle([sentence.text, ...distractors], `${article.articleId}:${id}:options`);
    const audioObjectPath = `assessments/articles/${article.articleId}/audio/${id}-${digest(sentence.text, 10)}.mp3`;
    const audioUrl = sentence.audioUrl || `https://storage.googleapis.com/${bucketName}/${audioObjectPath}`;
    return {
      public: {
        id,
        skill: "listening",
        prompt: "ฟังเสียง แล้วเลือกประโยคที่ได้ยิน",
        options,
        audioUrl,
      },
      correct: options.findIndex((option) => normalized(option) === normalized(sentence.text)),
      audioJob: sentence.audioUrl ? null : { id, text: sentence.text, objectPath: audioObjectPath },
    };
  });
}

function buildManifest(article, pool) {
  const forms = {};
  const answers = {};
  const audioJobs = [];
  for (const stage of ["PRE", "POST"]) {
    const items = [
      ...buildVocabularyItems(article, pool, stage),
      ...buildReadingItems(article, stage),
      ...buildListeningItems(article, pool, stage),
    ];
    forms[stage] = items.map((item) => item.public);
    answers[stage] = Object.fromEntries(items.map((item) => [item.public.id, item.correct]));
    audioJobs.push(...items.map((item) => item.audioJob).filter(Boolean));
  }
  const content = {
    schemaVersion: 1,
    bankVersion: BANK_VERSION,
    articleId: article.articleId,
    title: article.title,
    source: article.source === "primary" ? "PRIMARY_ADVANTAGE" : "READING_ADVANTAGE",
    bookLabels: article.bookLabels,
    cefrLevel: article.cefrLevel,
    blueprint: { total: 15, vocabulary: 5, reading: 5, listening: 5 },
    readingPassage: article.sentences.map((sentence) => sentence.text).join(" "),
    forms,
  };
  const version = `${BANK_VERSION}-${digest(JSON.stringify(content))}`;
  return { publicManifest: { ...content, version }, answerKey: { version, answers }, audioJobs };
}

function validateManifest(manifest, answerKey) {
  if (manifest.version !== answerKey.version) throw new Error(`${manifest.articleId} version mismatch`);
  for (const stage of ["PRE", "POST"]) {
    const items = manifest.forms[stage];
    if (items.length !== 15) throw new Error(`${manifest.articleId} ${stage} must contain 15 items`);
    const skills = items.reduce((counts, item) => ({ ...counts, [item.skill]: (counts[item.skill] || 0) + 1 }), {});
    for (const skill of ["vocabulary", "reading", "listening"]) {
      if (skills[skill] !== 5) throw new Error(`${manifest.articleId} ${stage} must contain five ${skill} items`);
    }
    for (const item of items) {
      const correct = answerKey.answers[stage][item.id];
      if (item.options.length !== 4 || !Number.isInteger(correct) || correct < 0 || correct > 3) {
        throw new Error(`${manifest.articleId} ${stage} has an invalid item ${item.id}`);
      }
      if (item.skill === "listening" && !item.audioUrl.startsWith("https://")) {
        throw new Error(`${manifest.articleId} ${stage} has no audio for ${item.id}`);
      }
    }
  }
}

async function uploadFiles(files) {
  const storage = new Storage();
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const index = next++;
      const file = files[index];
      await storage.bucket(bucketName).upload(file.localPath, {
        destination: file.objectPath,
        metadata: {
          contentType: "application/json; charset=utf-8",
          cacheControl: file.immutable ? "public,max-age=31536000,immutable" : "no-cache,max-age=0,must-revalidate",
        },
      });
      const [exists] = await storage.bucket(bucketName).file(file.objectPath).exists();
      if (!exists) throw new Error(`Uploaded object was not found: ${file.objectPath}`);
      console.log(`[${index + 1}/${files.length}] uploaded ${file.objectPath}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, files.length) }, () => worker()));
}

async function synthesize(textValue) {
  const apiKey = process.env.GOOGLE_TEXT_TO_SPEECH_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TEXT_TO_SPEECH_API_KEY is not configured");
  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: { text: textValue },
      voice: { languageCode: "en-US", name: process.env.TTS_VOICE_ID || "en-US-Neural2-C" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
    }),
  });
  if (!response.ok) throw new Error(`Google TTS ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if (!body.audioContent) throw new Error("Google TTS response did not contain audioContent");
  return Buffer.from(body.audioContent, "base64");
}

async function uploadMissingAudio(jobs) {
  const storage = new Storage();
  const uniqueJobs = uniqueBy(jobs, (job) => job.objectPath);
  let next = 0;
  let created = 0;
  let reused = 0;
  async function worker() {
    while (next < uniqueJobs.length) {
      const index = next++;
      const job = uniqueJobs[index];
      const file = storage.bucket(bucketName).file(job.objectPath);
      const [exists] = await file.exists();
      if (exists) {
        reused++;
        continue;
      }
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const audio = await synthesize(job.text);
          await file.save(audio, {
            resumable: false,
            metadata: { contentType: "audio/mpeg", cacheControl: "public,max-age=31536000,immutable" },
          });
          created++;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
        }
      }
      if (lastError) throw new Error(`Failed audio ${job.objectPath}: ${lastError.message || lastError}`);
      if ((index + 1) % 20 === 0 || index + 1 === uniqueJobs.length) {
        console.log(`[audio ${index + 1}/${uniqueJobs.length}] created ${created}, reused ${reused}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, uniqueJobs.length) }, () => worker()));
  return { total: uniqueJobs.length, created, reused };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const articles = await loadSourceArticles(catalog);
  await mkdir(PUBLIC_DIR, { recursive: true });
  const answerKeyCatalog = { schemaVersion: 1, bankVersion: BANK_VERSION, articles: {} };
  const index = { schemaVersion: 1, bankVersion: BANK_VERSION, generatedAt: new Date().toISOString(), articles: [] };
  const uploadQueue = [];
  const audioQueue = [];

  for (const article of articles) {
    const { publicManifest, answerKey, audioJobs } = buildManifest(article, articles);
    validateManifest(publicManifest, answerKey);
    const localPath = path.join(PUBLIC_DIR, `${article.articleId}.json`);
    await writeFile(localPath, `${JSON.stringify(publicManifest, null, 2)}\n`);
    answerKeyCatalog.articles[article.articleId] = answerKey;
    const objectPath = `assessments/articles/${article.articleId}/${publicManifest.version}.json`;
    index.articles.push({
      articleId: article.articleId,
      title: article.title,
      source: publicManifest.source,
      bookLabels: article.bookLabels,
      version: publicManifest.version,
      url: `https://storage.googleapis.com/${bucketName}/${objectPath}`,
    });
    uploadQueue.push({ localPath, objectPath, immutable: true });
    audioQueue.push(...audioJobs);
  }

  index.articles.sort((a, b) => a.articleId.localeCompare(b.articleId));
  await writeFile(ANSWER_KEY_PATH, `${JSON.stringify(answerKeyCatalog, null, 2)}\n`);
  const indexPath = path.join(PUBLIC_DIR, "index-v1.json");
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  uploadQueue.push({ localPath: indexPath, objectPath: "assessments/articles/index-v1.json", immutable: false });

  console.log(`Validated ${articles.length} article manifests (${articles.length * 30} assessment items).`);
  console.log(`${uniqueBy(audioQueue, (job) => job.objectPath).length} assessment audio objects are required because no matching article audio exists.`);
  if (validateOnly) return;
  if (shouldUpload) {
    const audio = await uploadMissingAudio(audioQueue);
    console.log(`Assessment audio ready: ${audio.total} total, ${audio.created} created, ${audio.reused} reused.`);
    await uploadFiles(uploadQueue);
    console.log(`Uploaded ${uploadQueue.length} JSON objects to gs://${bucketName}/assessments/articles/.`);
  } else {
    console.log("Local files generated. Add --upload to publish the student-safe manifests.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
