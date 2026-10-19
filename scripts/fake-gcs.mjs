#!/usr/bin/env node
/**
 * Local stand-in for Google Cloud Storage, so verification uploads can be
 * tested without touching the real bucket.
 *
 *   node scripts/fake-gcs.mjs            # listens on 127.0.0.1:4443
 *
 * Start a service with STORAGE_EMULATOR_HOST=http://127.0.0.1:4443 (set in the
 * shell; identity-service reloads .env with override, but .env has no such
 * key). @google-cloud/storage then sends every call here, without
 * credentials. If this server is not running, uploads fail instead of
 * reaching GCS.
 *
 * Covers what the services use: simple (multipart) uploads, object metadata,
 * deletes, and reads through signed URLs. Files are kept in
 * FAKE_GCS_DIR (default: <os tmp>/tutor-advantage-fake-gcs).
 */
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.FAKE_GCS_PORT || process.env.PORT || 4443);
const ROOT = path.resolve(process.env.FAKE_GCS_DIR || path.join(os.tmpdir(), "tutor-advantage-fake-gcs"));
fs.mkdirSync(ROOT, { recursive: true });

function objectPath(bucket, name) {
  const resolved = path.resolve(ROOT, bucket, name);
  if (!resolved.startsWith(ROOT + path.sep)) throw new Error("Object path escapes the storage folder");
  return resolved;
}

// CRC32C (Castagnoli), as GCS reports it: big-endian, base64. The client checks it after an upload.
const CRC32C_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32c(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32C_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return out.toString("base64");
}

function metadata(bucket, name) {
  const file = objectPath(bucket, name);
  if (!fs.existsSync(file)) return null;
  const sidecar = `${file}.meta.json`;
  const stored = fs.existsSync(sidecar) ? JSON.parse(fs.readFileSync(sidecar, "utf8")) : {};
  const stat = fs.statSync(file);
  const data = fs.readFileSync(file);
  return {
    kind: "storage#object",
    id: `${bucket}/${name}`,
    name,
    bucket,
    size: String(stat.size),
    contentType: stored.contentType || "application/octet-stream",
    md5Hash: crypto.createHash("md5").update(data).digest("base64"),
    crc32c: crc32c(data),
    generation: String(Math.floor(stat.mtimeMs)),
    updated: stat.mtime.toISOString(),
  };
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function notFound(res, what) {
  json(res, 404, { error: { code: 404, message: `No such object: ${what}` } });
}

/** Splits a multipart/related body into { headers, body } parts. */
function multipartParts(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(delimiter);
  while (start !== -1) {
    const next = buffer.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    const chunk = buffer.subarray(start + delimiter.length, next);
    const headerEnd = chunk.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headers = chunk.subarray(0, headerEnd).toString("utf8");
      let body = chunk.subarray(headerEnd + 4);
      if (body.subarray(-2).toString() === "\r\n") body = body.subarray(0, -2);
      parts.push({ headers, body });
    }
    start = next;
  }
  return parts;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname.replace(/^\/storage\/v1(?=\/)/, "");
  console.log(`${req.method} ${url.pathname}`);

  try {
    // Simple upload: POST /upload/storage/v1/b/<bucket>/o?uploadType=multipart&name=<name>
    const upload = /^\/upload\/storage\/v1\/b\/([^/]+)\/o$/.exec(url.pathname);
    if (upload && req.method === "POST") {
      if (url.searchParams.get("uploadType") !== "multipart") {
        return json(res, 501, { error: { code: 501, message: "Only simple (multipart) uploads are supported" } });
      }
      const boundary = /boundary="?([^";]+)"?/.exec(req.headers["content-type"] || "")?.[1];
      if (!boundary) return json(res, 400, { error: { code: 400, message: "Missing multipart boundary" } });
      const [meta, media] = multipartParts(await readBody(req), boundary);
      const info = meta ? JSON.parse(meta.body.toString("utf8") || "{}") : {};
      const name = url.searchParams.get("name") || info.name;
      if (!name || !media) return json(res, 400, { error: { code: 400, message: "Missing object name or data" } });
      const contentType = info.contentType || /content-type:\s*([^\r\n]+)/i.exec(media.headers)?.[1] || "application/octet-stream";
      const file = objectPath(upload[1], name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, media.body);
      fs.writeFileSync(`${file}.meta.json`, JSON.stringify({ contentType }));
      return json(res, 200, metadata(upload[1], name));
    }

    // JSON API object calls: /b/<bucket>/o/<name> (GET metadata, ?alt=media, DELETE)
    const object = /^\/b\/([^/]+)\/o\/(.+)$/.exec(route);
    if (object) {
      const bucket = object[1];
      const name = decodeURIComponent(object[2]);
      const info = metadata(bucket, name);
      if (!info) return notFound(res, name);
      if (req.method === "DELETE") {
        fs.rmSync(objectPath(bucket, name), { force: true });
        fs.rmSync(`${objectPath(bucket, name)}.meta.json`, { force: true });
        res.writeHead(204);
        return res.end();
      }
      if (req.method === "GET" && url.searchParams.get("alt") !== "media") return json(res, 200, info);
      res.writeHead(200, { "Content-Type": info.contentType });
      return fs.createReadStream(objectPath(bucket, name)).pipe(res);
    }

    // Signed URL reads: GET /<bucket>/<name>?X-Goog-Signature=… (the signature is not checked)
    const signed = /^\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (signed && (req.method === "GET" || req.method === "HEAD")) {
      const name = decodeURIComponent(signed[2]);
      const info = metadata(signed[1], name);
      if (!info) return notFound(res, name);
      res.writeHead(200, { "Content-Type": info.contentType, "Content-Length": info.size, "Cache-Control": "no-store" });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(objectPath(signed[1], name)).pipe(res);
    }

    json(res, 404, { error: { code: 404, message: `Not supported by fake-gcs: ${req.method} ${url.pathname}` } });
  } catch (error) {
    json(res, 500, { error: { code: 500, message: error instanceof Error ? error.message : String(error) } });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`fake-gcs listening on http://127.0.0.1:${PORT}, files in ${ROOT}`);
});
