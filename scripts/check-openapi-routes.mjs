import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const services = [
  {
    source: "services/identity-service/src/index.ts",
    spec: "packages/contracts/openapi/identity.v1.yaml",
    critical: ["get /v1/session", "patch /v1/users/me/profile"],
  },
  {
    source: "services/learning-service/src/index.ts",
    spec: "packages/contracts/openapi/learning.v1.yaml",
    critical: ["post /v1/enroll/{referralToken}"],
  },
  {
    source: "services/finance-mlm-service/src/index.ts",
    spec: "packages/contracts/openapi/finance-mlm.v1.yaml",
    critical: [
      "post /v1/payments/intent",
      "post /v1/payments/webhook",
      "post /v1/settlements/preview",
    ],
  },
];

const failures = [];
for (const service of services) {
  const source = fs.readFileSync(path.resolve(service.source), "utf8");
  const document = parse(fs.readFileSync(path.resolve(service.spec), "utf8"));
  const implemented = new Set();
  const routePattern =
    /app\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;

  for (const match of source.matchAll(routePattern)) {
    const openApiPath = match[2].replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    implemented.add(`${match[1]} ${openApiPath}`);
  }

  const documented = new Set();
  for (const [routePath, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      if (pathItem?.[method]) documented.add(`${method} ${routePath}`);
    }
  }

  for (const operation of documented) {
    if (!implemented.has(operation)) {
      failures.push(`${service.spec}: documented but not implemented: ${operation}`);
    }
  }
  for (const operation of service.critical) {
    if (!documented.has(operation) || !implemented.has(operation)) {
      failures.push(`${service.spec}: critical contract drift: ${operation}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("OpenAPI route contracts match their service implementations.");
