#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "packages", "database", "catalog-157-articles.json");
const GENERATOR_PATH = path.join(ROOT, "scripts", "generate-article-tts.mjs");
const VOICE_POOL = [
  "en-US-Neural2-A",
  "en-US-Neural2-C",
  "en-US-Neural2-D",
  "en-US-Neural2-E",
  "en-US-Neural2-F",
  "en-US-Neural2-G",
  "en-US-Neural2-H",
  "en-US-Neural2-I",
  "en-US-Neural2-J",
];

const args = {};
for (let index = 2; index < process.argv.length; index++) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const key = value.slice(2);
  const next = process.argv[index + 1];
  args[key] = next && !next.startsWith("--") ? next : true;
}

const concurrency = Math.max(1, Math.min(16, Number(args.concurrency || 4)));
const retries = Math.max(0, Math.min(5, Number(args.retries ?? 2)));
const requestedSource = String(args.source || "all").toLowerCase();
const dryRun = Boolean(args["dry-run"]);
const force = Boolean(args.force);

if (!["all", "reading", "primary"].includes(requestedSource)) {
  console.error("Usage: node scripts/generate-catalog-tts.mjs [--source all|reading|primary] [--concurrency 4] [--retries 2] [--dry-run]");
  process.exit(1);
}

function normalizeSource(value) {
  return String(value || "").toLowerCase().includes("primary") ? "primary" : "reading";
}

function voiceForArticle(articleId) {
  const digest = createHash("sha1").update(articleId).digest();
  return VOICE_POOL[digest[0] % VOICE_POOL.length];
}

function runGenerator(job) {
  return new Promise((resolve) => {
    const manifestPath = path.join(ROOT, "packages", "database", "tts-manifests", `${job.source}-${job.articleId}.json`);
    const child = spawn(process.execPath, [
      GENERATOR_PATH,
      "--source", job.source,
      ...(force
        ? ["--input", manifestPath]
        : ["--from-db", job.source, "--input", CATALOG_PATH]),
      "--article-id", job.articleId,
      "--voice", voiceForArticle(job.articleId),
      ...(dryRun ? ["--dry-run"] : []),
      ...(force ? ["--force"] : []),
    ], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ ok: false, error: error.message }));
    child.on("close", (code, signal) => resolve({
      ok: code === 0,
      code,
      signal,
      stdout,
      stderr,
    }));
  });
}

function tail(text, lines = 8) {
  return String(text || "").trim().split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const unique = new Map();
for (const item of catalog) {
  const articleId = String(item.articleId || item.id || "").trim();
  if (!articleId || unique.has(articleId)) continue;
  const source = normalizeSource(item.source);
  if (requestedSource !== "all" && source !== requestedSource) continue;
  unique.set(articleId, {
    articleId,
    source,
    title: String(item.title || articleId),
  });
}

const allJobs = [...unique.values()];
const jobs = [];
let skipped = 0;
for (const job of allJobs) {
  if (!dryRun) {
    try {
      const manifestPath = path.join(ROOT, "packages", "database", "tts-manifests", `${job.source}-${job.articleId}.json`);
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const completeForRequestedVoice = manifest.generatedAt
        && (!force || manifest.voice?.voiceId === voiceForArticle(job.articleId));
      if (completeForRequestedVoice) {
        skipped++;
        continue;
      }
    } catch {
      // A missing or incomplete local manifest must be generated.
    }
  }
  jobs.push(job);
}
console.log(`Queued ${jobs.length} articles from catalog (${requestedSource}), skipped ${skipped} completed, concurrency ${concurrency}, retries ${retries}${dryRun ? ", dry-run" : ""}${force ? ", force regenerate" : ""}`);

let nextIndex = 0;
let completed = 0;
let succeeded = 0;
const failures = [];

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= jobs.length) return;
    const job = jobs[index];
    let result;
    for (let attempt = 0; attempt <= retries; attempt++) {
      result = await runGenerator(job);
      if (result.ok) break;
      if (attempt < retries) {
        console.log(`[${index + 1}/${jobs.length}] retry ${attempt + 1}/${retries} ${job.source} ${job.articleId}`);
      }
    }

    completed++;
    if (result.ok) {
      succeeded++;
      console.log(`[${completed}/${jobs.length}] OK ${job.source} | ${job.title} | ${job.articleId}`);
    } else {
      const detail = tail(result.stderr) || tail(result.stdout) || result.error || `exit ${result.code}`;
      failures.push({ ...job, detail });
      console.error(`[${completed}/${jobs.length}] FAILED ${job.source} | ${job.title} | ${job.articleId}\n${detail}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));

console.log(`Finished: ${succeeded}/${jobs.length} succeeded, ${failures.length} failed`);
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
