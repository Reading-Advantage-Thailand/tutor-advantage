#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Storage } from "@google-cloud/storage";
import { Pool } from "pg";

const ROOT = process.cwd();
const DEFAULT_BUCKET = process.env.GCS_BUCKET_NAME || "tutor_advantage_bucket";
const DEFAULT_VOICE = process.env.TTS_VOICE_ID || "en-US-Neural2-C";

function loadDotEnv() {
  try {
    const lines = readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Environment variables may already be provided by CI.
  }
}

loadDotEnv();

const args = {};
for (let index = 2; index < process.argv.length; index++) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  args[key] = next && !next.startsWith("--") ? next : true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const source = String(args.source || "").toLowerCase();
const inputPath = args.input ? path.resolve(String(args.input)) : null;
const articleId = String(args["article-id"] || "");
const fromDatabase = String(args["from-db"] || "").toLowerCase();
const bucketName = String(args.bucket || process.env.GCS_BUCKET_NAME || DEFAULT_BUCKET);
const voiceId = String(args.voice || process.env.TTS_VOICE_ID || DEFAULT_VOICE);
const dryRun = Boolean(args["dry-run"]);

if ((!inputPath && !["reading", "primary"].includes(fromDatabase)) || !articleId || !["reading", "primary"].includes(source)) {
  console.error("Usage: node scripts/generate-article-tts.mjs --source reading|primary --input <workbook.json> --article-id <id> [--voice <voice>] [--dry-run]");
  console.error("       node scripts/generate-article-tts.mjs --source reading|primary --from-db reading|primary --article-id <id> [--voice <voice>]");
  process.exit(1);
}

function textOf(value) {
  return String(value ?? "").trim();
}

function splitParagraph(text) {
  // Workbooks already contain authored punctuation. This splitter is only a
  // deterministic fallback; it never asks an LLM to invent or omit text.
  return textOf(text).match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [];
}

function stableId(kind, order, text) {
  const digest = createHash("sha1").update(`${kind}\0${order}\0${text}`).digest("hex").slice(0, 10);
  return `${kind}-${String(order + 1).padStart(3, "0")}-${digest}`;
}

function sentenceWordTexts(sentences) {
  const seen = new Set();
  return sentences
    .flatMap((sentence) => textOf(sentence).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [])
    .map((word) => word.replace(/[’]/g, "'").toLowerCase())
    .filter((word) => {
      if (!word || seen.has(word)) return false;
      seen.add(word);
      return true;
    });
}

function objectPath(kind, id) {
  const directory = kind === "sentence" ? "sentences" : kind === "word" ? "words" : "questions";
  return `articles/${articleId}/${directory}/${id}.mp3`;
}

function audioUrl(object) {
  return `https://storage.googleapis.com/${bucketName}/${object}`;
}

async function synthesize(text) {
  const apiKey = process.env.GOOGLE_TEXT_TO_SPEECH_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TEXT_TO_SPEECH_API_KEY is not configured");
  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-US", name: voiceId },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.9 },
    }),
  });
  if (!response.ok) throw new Error(`Google TTS ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  if (!payload.audioContent) throw new Error("Google TTS response did not contain audioContent");
  return Buffer.from(payload.audioContent, "base64");
}

async function loadInput() {
  if (!["reading", "primary"].includes(fromDatabase)) {
    const input = JSON.parse(await readFile(inputPath, "utf8"));
    return normalizeCatalogInput(Array.isArray(input) ? input.find((item) => item.articleId === articleId) : input);
  }

  let databaseUrl = process.env.DATABASE_URL_READING_ADVANTAGE || process.env.DATABASE_URL;
  if (fromDatabase === "primary") {
    const primaryEnvPath = process.env.PRIMARY_ADVANTAGE_ENV_FILE || "C:/Repository/primary-advantage/.env";
    try {
      for (const line of readFileSync(primaryEnvPath, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
        if (match && match[1] === "DATABASE_URL") {
          databaseUrl = match[2].replace(/^['"]|['"]$/g, "");
          break;
        }
      }
    } catch {
      databaseUrl = process.env.DATABASE_URL_PRIMARY_ADVANTAGE || process.env.DATABASE_URL;
    }
  }
  if (!databaseUrl) throw new Error(`DATABASE_URL_${fromDatabase.toUpperCase()}_ADVANTAGE is not configured`);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const articleResult = await pool.query(
      fromDatabase === "primary"
        ? "SELECT id, title, sentences, words FROM article WHERE id = $1 AND is_published = true"
        : 'SELECT id, title, sentences, words FROM "article" WHERE id = $1',
      [articleId],
    );
    const article = articleResult.rows[0];
    if (!article) {
      if (!inputPath) throw new Error(`${fromDatabase} article not found or unpublished: ${articleId}`);
      const catalog = JSON.parse(await readFile(inputPath, "utf8"));
      const fallback = normalizeCatalogInput(Array.isArray(catalog)
        ? catalog.find((item) => item.articleId === articleId)
        : catalog);
      if (!fallback) throw new Error(`${fromDatabase} article not found or unpublished: ${articleId}`);
      console.warn(`Using catalog fallback for ${fromDatabase} article ${articleId}`);
      return fallback;
    }

    const [mcqResult, saqResult, flashcardResult] = await Promise.all(fromDatabase === "primary"
      ? [
        pool.query("SELECT question, options FROM multiple_choice_questions WHERE article_id = $1 ORDER BY id", [articleId]),
        pool.query("SELECT question FROM short_answer_questions WHERE article_id = $1 ORDER BY id", [articleId]),
        pool.query("SELECT words FROM sentencs_and_words_for_flashcard WHERE article_id = $1 LIMIT 1", [articleId]),
      ]
      : [
        pool.query('SELECT question, options FROM "MultipleChoiceQuestion" WHERE article_id = $1 ORDER BY "createdAt", id', [articleId]),
        pool.query('SELECT question FROM "ShortAnswerQuestion" WHERE article_id = $1 ORDER BY "createdAt", id', [articleId]),
        Promise.resolve({ rows: [] }),
      ]);
    const sentenceValues = Array.isArray(article.sentences) ? article.sentences : [];
    const sentenceTexts = sentenceValues.map((sentence) => typeof sentence === "object"
      ? sentence.sentences || sentence.text || sentence.sentence || ""
      : String(sentence || ""));
    if (!sentenceTexts.some((text) => textOf(text))) {
      if (!inputPath) throw new Error(`${fromDatabase} article has no sentence text: ${articleId}`);
      const catalog = JSON.parse(await readFile(inputPath, "utf8"));
      const fallback = normalizeCatalogInput(Array.isArray(catalog)
        ? catalog.find((item) => item.articleId === articleId)
        : catalog);
      if (!fallback) throw new Error(`${fromDatabase} article has no sentence text: ${articleId}`);
      console.warn(`Using catalog text fallback for ${fromDatabase} article ${articleId}`);
      return fallback;
    }
    return {
      lesson_title: article.title,
      preserve_sentences: true,
      article_paragraphs: sentenceValues.map((sentence) => ({
        text: typeof sentence === "object"
          ? sentence.sentences || sentence.text || sentence.sentence || ""
          : String(sentence || ""),
      })),
      vocabulary: (Array.isArray(article.words) && article.words.length
        ? article.words
        : flashcardResult.rows[0]?.words || []).map((word) => ({
        word: word?.vocabulary || word?.word || word?.text || "",
      })),
      comprehension_questions: mcqResult.rows.map((question) => ({
        question: question.question,
        options: Array.isArray(question.options)
          ? question.options
          : Object.values(question.options || {}),
      })),
      short_answer_questions: saqResult.rows.map((question) => ({ question: question.question })),
    };
  } finally {
    await pool.end();
  }
}

function normalizeCatalogInput(input) {
  if (!input) throw new Error(`Catalog article not found: ${articleId}`);
  if (Array.isArray(input.article_paragraphs)) return input;
  return {
    lesson_title: input.title,
    preserve_sentences: true,
    article_paragraphs: (input.sentences || []).map((sentence) => ({ text: textOf(sentence) })),
    vocabulary: (input.words || []).map((word) => ({
      word: word?.vocabulary || word?.word || word?.text || word,
    })),
    comprehension_questions: input.comprehension_questions || input.questions || [],
    short_answer_questions: input.short_answer_questions || input.saqs || [],
  };
}

async function upload(storage, localPath, destination, contentType, cacheControl = "public,max-age=31536000,immutable") {
  await storage.bucket(bucketName).upload(localPath, {
    destination,
    metadata: { contentType, cacheControl },
  });
  const [exists] = await storage.bucket(bucketName).file(destination).exists();
  if (!exists) throw new Error(`Uploaded object was not found: ${destination}`);
}

async function main() {
  const workbook = await loadInput();
  const sentences = workbook.preserve_sentences
    ? (workbook.article_paragraphs || []).map((paragraph) => textOf(paragraph.text)).filter(Boolean)
    : (workbook.article_paragraphs || []).flatMap((paragraph) => splitParagraph(paragraph.text));
  const words = (workbook.vocabulary || []).map((item) => textOf(item.word || item.vocabulary)).filter(Boolean);
  const curatedWordKeys = new Set(words.map((word) => word.toLowerCase()));
  const sentenceWords = sentenceWordTexts(sentences)
    .filter((word) => !curatedWordKeys.has(word))
    .map((text, index) => {
      const order = words.length + index;
      const id = stableId("word", order, text);
      const object = objectPath("word", id);
      return { id, order, text, objectPath: object, audioUrl: audioUrl(object), status: "pending" };
    });
  const questions = [
    ...(workbook.comprehension_questions || []).map((item) => ({ type: "mcq", question: item.question, options: item.options })),
    ...(Array.isArray(workbook.short_answer_questions)
      ? workbook.short_answer_questions.map((item) => ({ type: "saq", question: item.question }))
      : workbook.short_answer_question ? [{ type: "saq", question: workbook.short_answer_question }] : []),
  ];
  if (!sentences.length) throw new Error("Workbook has no article_paragraphs");

  const manifest = {
    version: 1,
    articleId,
    source: source === "primary" ? "PRIMARY_ADVANTAGE" : "READING_ADVANTAGE",
    title: workbook.lesson_title,
    voice: { provider: "google-cloud-text-to-speech", voiceId, languageCode: "en-US", speakingRate: 0.9 },
    sentences: sentences.map((text, order) => {
      const id = stableId("sentence", order, text);
      const object = objectPath("sentence", id);
      return { id, order, text, objectPath: object, audioUrl: audioUrl(object), status: "pending" };
    }),
    words: words.map((text, order) => {
      const id = stableId("word", order, text);
      const object = objectPath("word", id);
      return { id, order, text, objectPath: object, audioUrl: audioUrl(object), status: "pending" };
    }),
    sentenceWords,
    questions: questions.map((question, order) => {
      const questionId = `${question.type === "saq" ? "saq" : "mcq"}-${String(order + 1).padStart(3, "0")}-${createHash("sha1").update(`question\0${order}\0${question.question}`).digest("hex").slice(0, 10)}`;
      const questionObject = objectPath("question", questionId);
      const optionAudioUrls = {};
      const optionFiles = [];
      (question.options || []).forEach((option, optionIndex) => {
        const key = `option${optionIndex + 1}`;
        const optionId = `${questionId}-${key}-${createHash("sha1").update(`option\0${order}\0${key}\0${option}`).digest("hex").slice(0, 8)}`;
        const object = objectPath("question", optionId);
        optionAudioUrls[key] = audioUrl(object);
        optionFiles.push({ id: optionId, text: option, objectPath: object, status: "pending" });
      });
      return { id: questionId, type: question.type, order, text: question.question, questionAudioUrl: audioUrl(questionObject), questionObjectPath: questionObject, optionAudioUrls, optionFiles };
    }),
  };

  const outputDir = path.join(ROOT, "packages", "database", "tts-manifests");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${source}-${articleId}.json`);
  if (dryRun) {
    await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Dry run: ${sentences.length} sentences, ${words.length} words -> ${outputPath}`);
    return;
  }

  const storage = new Storage();
  const tempDir = path.join(ROOT, ".tmp", "tts", articleId);
  await mkdir(tempDir, { recursive: true });

  const questionFiles = manifest.questions.flatMap((question) => [
    { id: question.id, text: question.text, objectPath: question.questionObjectPath, status: "pending", kind: "question" },
    ...(question.optionFiles || []).map((item) => ({ ...item, kind: "question" })),
  ]);
  for (const item of [...manifest.sentences, ...manifest.words, ...manifest.sentenceWords, ...questionFiles]) {
    const remoteFile = storage.bucket(bucketName).file(item.objectPath);
    const [alreadyUploaded] = await remoteFile.exists();
    if (alreadyUploaded) {
      item.status = "ready";
      console.log(`Already exists ${item.id}`);
      continue;
    }
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const localPath = path.join(tempDir, `${item.id}.mp3`);
      try {
        const audio = await synthesize(item.text);
        await writeFile(localPath, audio);
        await upload(storage, localPath, item.objectPath, "audio/mpeg");
        item.status = "ready";
        await unlink(localPath).catch(() => {});
        break;
      } catch (error) {
        lastError = error;
        const message = String(error?.message || error);
        const quotaLimited = /429|RESOURCE_EXHAUSTED|quota/i.test(message);
        await sleep(quotaLimited ? 30000 * 2 ** (attempt - 1) : 500 * 2 ** (attempt - 1));
      }
    }
    if (item.status !== "ready") throw new Error(`Failed ${item.id}: ${lastError?.message || lastError}`);
    console.log(`Uploaded ${item.id}`);
  }

  manifest.generatedAt = new Date().toISOString();
  const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(outputPath, manifestJson);
  const manifestPath = path.join(tempDir, "manifest.json");
  await writeFile(manifestPath, manifestJson);
  await upload(
    storage,
    manifestPath,
    `articles/${articleId}/manifest.json`,
    "application/json",
    "no-cache,max-age=0,must-revalidate",
  );
  await unlink(manifestPath).catch(() => {});
  console.log(`Generated manifest: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
