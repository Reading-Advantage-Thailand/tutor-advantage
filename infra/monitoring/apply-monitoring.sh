#!/usr/bin/env bash
# Tutor Advantage — Cloud Monitoring setup (uptime checks, alert policies and
# the Discord relay notification channel). Safe to re-run: every resource is
# looked up by displayName and updated in place instead of duplicated.
#
# Usage:
#   infra/monitoring/apply-monitoring.sh            # apply to reading-advantage
#   DRY_RUN=1 infra/monitoring/apply-monitoring.sh  # print the JSON bodies only
#
# Env overrides:
#   PROJECT (reading-advantage), REGION (asia-southeast1)
#   IDENTITY_SERVICE_URL, LEARNING_SERVICE_URL, FINANCE_MLM_SERVICE_URL,
#   STUDENT_LIFF_URL, TUTOR_PWA_URL, ADMIN_CONSOLE_URL
#     Base URL of each Cloud Run service. Default: gcloud run services describe.
#     In DRY_RUN a missing one becomes https://<service>.example.invalid.
#   RELAY_URL      full relay endpoint (default <identity>/v1/internal/alerts/monitoring)
#   INTERNAL_KEY_SECRET (ta-internal_api_key) Secret Manager secret holding the
#                  Basic-auth password. Read at run time, never printed.
#   DRY_RUN_OUT    with DRY_RUN=1, also save each body as a file in this directory.
#
# Needs: gcloud (authenticated, monitoring.editor + secretAccessor on the key),
# curl, python3. Uses the Monitoring REST API, so no gcloud alpha/beta components.
# See docs/runbooks/monitoring-alerts.md.

set -euo pipefail

PROJECT="${PROJECT:-reading-advantage}"
REGION="${REGION:-asia-southeast1}"
DRY_RUN="${DRY_RUN:-0}"
INTERNAL_KEY_SECRET="${INTERNAL_KEY_SECRET:-ta-internal_api_key}"
API="https://monitoring.googleapis.com/v3/projects/${PROJECT}"
CHANNEL_NAME="Tutor Advantage → Discord relay"

BACKENDS=(identity-service learning-service finance-mlm-service)
FRONTENDS=(student-liff tutor-pwa admin-console)

is_dry_run() { [[ "$DRY_RUN" == "1" || "$DRY_RUN" == "true" ]]; }

PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
    PY="$candidate"
    break
  fi
done
[[ -n "$PY" ]] || { echo "python3 (>= 3.8) is required" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }

umask 077
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# upsert runs inside $(...) subshells, so the summary goes through a file.
: >"$WORK/summary"
note() { echo "$1" >>"$WORK/summary"; }

# ---------------------------------------------------------------------------
# JSON helpers (python, so Thai text, quotes and the password are escaped
# correctly and nothing secret goes on a command line).
# ---------------------------------------------------------------------------
cat >"$WORK/gen.py" <<'PY'
import json, os, sys, urllib.parse

RUNBOOK = "docs/runbooks/monitoring-alerts.md"
TA_SERVICES = ["identity-service", "learning-service", "finance-mlm-service",
               "student-liff", "tutor-pwa", "admin-console"]
CHANNEL_NAME = os.environ["CHANNEL_NAME"]
PROJECT = os.environ["PROJECT"]


def write(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def doc(th, en, section):
    return {
        "mimeType": "text/markdown",
        "content": f"{th}\n\n{en}\n\nRunbook: `{RUNBOOK}` → {section}",
    }


def strategy(log_match=False):
    s = {"autoClose": "86400s"}
    if log_match:
        s["notificationRateLimit"] = {"period": "300s"}
    return s


def policy(name, severity, conditions, documentation, log_match=False):
    return {
        "displayName": name,
        "combiner": "OR",
        "enabled": True,
        "severity": severity,
        "userLabels": {"app": "tutor-advantage"},
        "conditions": conditions,
        "documentation": documentation,
        "alertStrategy": strategy(log_match),
        "notificationChannels": [os.environ["CHANNEL_ID"]],
    }


def log_condition(name, flt):
    return {"displayName": name, "conditionMatchedLog": {"filter": flt}}


def cmd_channel(out, url, password_file):
    if password_file:
        with open(password_file, encoding="utf-8") as f:
            password = f.read().strip()
    else:
        password = "<read from Secret Manager at run time>"
    write(out, {
        "type": "webhook_basicauth",
        "displayName": CHANNEL_NAME,
        "description": "Relays Cloud Monitoring incidents to the Tutor Advantage Discord channel via "
                       "identity-service POST /v1/internal/alerts/monitoring. See " + RUNBOOK + ".",
        "labels": {"url": url, "username": "monitoring", "password": password},
        "userLabels": {"app": "tutor-advantage"},
        "enabled": True,
    })


def cmd_uptime(out, service, base_url, kind):
    # kind, not a path argument: Git Bash on Windows rewrites "/health" into a file path.
    path, allow_redirects = ("/health", False) if kind == "backend" else ("/", True)
    host = base_url.split("://", 1)[-1].split("/", 1)[0]
    codes = [{"statusClass": "STATUS_CLASS_2XX"}]
    if allow_redirects:
        codes.append({"statusClass": "STATUS_CLASS_3XX"})
    write(out, {
        "displayName": f"TA uptime: {service}",
        "monitoredResource": {"type": "uptime_url", "labels": {"project_id": PROJECT, "host": host}},
        "httpCheck": {
            "requestMethod": "GET",
            "useSsl": True,
            "validateSsl": True,
            "port": 443,
            "path": path,
            "acceptedResponseStatusCodes": codes,
        },
        "period": "300s",
        "timeout": "10s",
        "userLabels": {"app": "tutor-advantage", "service": service},
    })


def cmd_service_down(out, service, check_id):
    flt = (
        'metric.type="monitoring.googleapis.com/uptime_check/check_passed" '
        'AND resource.type="uptime_url" '
        f'AND metric.label.check_id="{check_id}"'
    )
    cond = {
        "displayName": f"Uptime check failing from 2+ regions: {service}",
        "conditionThreshold": {
            "filter": flt,
            "aggregations": [{
                "alignmentPeriod": "600s",
                "perSeriesAligner": "ALIGN_NEXT_OLDER",
                "crossSeriesReducer": "REDUCE_COUNT_FALSE",
                "groupByFields": ["resource.label.host"],
            }],
            "comparison": "COMPARISON_GT",
            "thresholdValue": 1,
            "duration": "300s",
            "trigger": {"count": 1},
        },
    }
    write(out, policy(
        f"TA: service down ({service})", "CRITICAL", [cond],
        doc(f"**{service}** ตอบ health check ไม่ผ่านจากหลาย region นานเกิน 5 นาที — "
            "เปิด Cloud Run ดู revision ล่าสุด, log ช่วงเวลาเดียวกัน และ Cloud SQL",
            f"**{service}** has failed its uptime check from 2+ regions for 5 minutes. "
            "Check the latest Cloud Run revision, its logs around the start time, and Cloud SQL.",
            "Service down"),
    ))


def cmd_5xx(out):
    services = ",".join(f'"{s}"' for s in TA_SERVICES)
    cond = {
        "displayName": "5xx responses > 10 in 5 min (per service)",
        "conditionThreshold": {
            "filter": (
                'metric.type="run.googleapis.com/request_count" '
                'AND resource.type="cloud_run_revision" '
                'AND metric.label.response_code_class="5xx" '
                f"AND resource.label.service_name=one_of({services})"
            ),
            "aggregations": [{
                "alignmentPeriod": "300s",
                "perSeriesAligner": "ALIGN_DELTA",
                "crossSeriesReducer": "REDUCE_SUM",
                "groupByFields": ["resource.label.service_name"],
            }],
            "comparison": "COMPARISON_GT",
            "thresholdValue": 10,
            "duration": "0s",
            "trigger": {"count": 1},
        },
    }
    write(out, policy(
        "TA: 5xx spike", "ERROR", [cond],
        doc("มี response 5xx มากกว่า 10 ครั้งใน 5 นาทีจาก service เดียว — "
            "ดู error ที่ส่งเข้า Discord ช่วงเดียวกัน และ Logs Explorer (severity>=ERROR) ของ service นั้น",
            "More than 10 HTTP 5xx responses in 5 minutes from one service. "
            "Look at the app errors posted to Discord at the same time and the service's ERROR logs.",
            "5xx spike"),
    ))


def cmd_scheduler(out):
    write(out, policy(
        "TA: Cloud Scheduler job failed", "ERROR",
        [log_condition("Cloud Scheduler ta-* job logged an error",
                       'resource.type="cloud_scheduler_job" AND resource.labels.job_id=~"^ta-" AND severity>=ERROR')],
        doc("งาน Cloud Scheduler ของ TA (ta-*) เรียก internal route ไม่สำเร็จ — "
            "ดู job ใน Cloud Scheduler (status / attempt) และ log ของ service ปลายทาง",
            "A TA Cloud Scheduler job (ta-*) failed to call its internal route. "
            "Check the job's last attempt in Cloud Scheduler and the target service's logs "
            "(401 = INTERNAL_API_KEY mismatch, 5xx/503 = the run itself failed).",
            "Cloud Scheduler job failed"),
        log_match=True,
    ))


def cmd_migration(out):
    write(out, policy(
        "TA: DB migration job failed", "CRITICAL",
        [log_condition("tutor-advantage-db-migrate logged an error",
                       'resource.type="cloud_run_job" AND resource.labels.job_name="tutor-advantage-db-migrate" '
                       "AND severity>=ERROR")],
        doc("Cloud Run job tutor-advantage-db-migrate ล้มเหลว — deploy ของ service จะไม่ถูกปล่อยต่อ "
            "ดู execution ล่าสุดของ job และ GitHub Actions run ที่เรียกมัน",
            "The tutor-advantage-db-migrate Cloud Run job failed, so the deploy did not continue. "
            "Open the job's latest execution logs and the GitHub Actions deploy run.",
            "DB migration job failed"),
        log_match=True,
    ))


def cmd_crash(out):
    services = " OR ".join(f'"{s}"' for s in TA_SERVICES)
    flt = (
        'resource.type="cloud_run_revision" '
        f"AND resource.labels.service_name=({services}) "
        'AND (textPayload:"Container called exit(1)" '
        'OR jsonPayload.message="Uncaught exception" '
        'OR jsonPayload.message:"uncaughtException")'
    )
    write(out, policy(
        "TA: container crash loop", "CRITICAL",
        [log_condition("TA container exited with an uncaught exception", flt)],
        doc("container ของ TA ปิดตัวด้วย exit(1) / uncaught exception — "
            "ถ้าเกิดซ้ำต่อเนื่องคือ crash loop: ดู log ก่อนหน้า exit, env/secret ที่เพิ่งเปลี่ยน และ rollback revision ถ้าจำเป็น",
            "A TA container exited with exit(1) or an uncaught exception. Repeats mean a crash loop: "
            "read the logs just before the exit, check recently changed env vars/secrets, and roll back "
            "to the previous revision if needed.",
            "Container crash loop"),
        log_match=True,
    ))


def cmd_find(list_file, display_name, type_filter=""):
    """Print the resource name whose displayName matches, or nothing."""
    with open(list_file, encoding="utf-8") as f:
        items = json.load(f)
    hits = [i for i in items
            if i.get("displayName") == display_name and (not type_filter or i.get("type") == type_filter)]
    if len(hits) > 1:
        print(f"WARN: {len(hits)} resources named {display_name!r}; updating the first", file=sys.stderr)
    if hits:
        print(hits[0]["name"])


def cmd_get(file, key):
    with open(file, encoding="utf-8") as f:
        value = json.load(f)
    for part in key.split("."):
        value = value.get(part, {}) if isinstance(value, dict) else {}
    print(value if isinstance(value, str) else "")


def cmd_merge(page_file, collection, acc_file):
    """Append one list page's items to acc_file; print nextPageToken, URL-encoded."""
    with open(page_file, encoding="utf-8") as f:
        page = json.load(f)
    acc = []
    if os.path.exists(acc_file):
        with open(acc_file, encoding="utf-8") as f:
            acc = json.load(f)
    acc.extend(page.get(collection, []))
    with open(acc_file, "w", encoding="utf-8") as f:
        json.dump(acc, f)
    # Page tokens are opaque and may hold base64 "+", "/", "=": encode them
    # so the next request's query string carries them intact.
    print(urllib.parse.quote(page.get("nextPageToken", ""), safe=""))


COMMANDS = {
    "channel": cmd_channel, "uptime": cmd_uptime, "service-down": cmd_service_down,
    "5xx": cmd_5xx, "scheduler": cmd_scheduler, "migration": cmd_migration, "crash": cmd_crash,
    "find": cmd_find, "get": cmd_get, "merge": cmd_merge,
}

if __name__ == "__main__":
    COMMANDS[sys.argv[1]](*sys.argv[2:])
PY

gen() { CHANNEL_NAME="$CHANNEL_NAME" PROJECT="$PROJECT" CHANNEL_ID="${CHANNEL_ID:-}" "$PY" "$WORK/gen.py" "$@"; }

# ---------------------------------------------------------------------------
# REST helpers. The bearer token lives in a 0600 header file read by curl -H @file.
# ---------------------------------------------------------------------------
if ! is_dry_run; then
  command -v gcloud >/dev/null 2>&1 || { echo "gcloud is required" >&2; exit 1; }
  printf 'Authorization: Bearer %s\n' "$(gcloud auth print-access-token)" >"$WORK/auth_header"
fi

# api METHOD URL [BODY_FILE] → response JSON in $WORK/resp.json; exits on HTTP >= 300.
api() {
  local method="$1" url="$2" body="${3:-}" code
  local args=(-sS -o "$WORK/resp.json" -w '%{http_code}' -X "$method"
    -H @"$WORK/auth_header" -H 'Content-Type: application/json; charset=utf-8')
  [[ -n "$body" ]] && args+=(--data-binary @"$body")
  code="$(curl "${args[@]}" "$url")"
  if [[ "$code" -ge 300 ]]; then
    echo "ERROR: $method ${url%%\?*} → HTTP $code" >&2
    cat "$WORK/resp.json" >&2
    exit 1
  fi
}

# list_all COLLECTION → all items in $WORK/list-COLLECTION.json
list_all() {
  local collection="$1" acc="$WORK/list-$1.json" token="" url
  rm -f "$acc"
  echo '[]' >"$acc"
  while :; do
    url="$API/$collection?pageSize=100"
    [[ -n "$token" ]] && url+="&pageToken=$token" # already URL-encoded by gen merge
    api GET "$url"
    token="$(gen merge "$WORK/resp.json" "$collection" "$acc")"
    [[ -n "$token" ]] || break
  done
}

# upsert COLLECTION DISPLAY_NAME BODY_FILE UPDATE_MASK [TYPE] → resource name on stdout
upsert() {
  local collection="$1" display="$2" body="$3" mask="$4" type="${5:-}" existing
  if is_dry_run; then
    echo "----- $collection: $display (create or update) -----" >&2
    cat "$body" >&2
    if [[ -n "${DRY_RUN_OUT:-}" ]]; then
      mkdir -p "$DRY_RUN_OUT"
      cp "$body" "$DRY_RUN_OUT/$(basename "$body")"
    fi
    note "[dry-run] $collection: $display"
    echo "projects/$PROJECT/$collection/DRYRUN-$(basename "$body" .json)"
    return
  fi
  existing="$(gen find "$WORK/list-$collection.json" "$display" "$type")"
  if [[ -n "$existing" ]]; then
    local url="https://monitoring.googleapis.com/v3/$existing"
    [[ -n "$mask" ]] && url+="?updateMask=$mask"
    api PATCH "$url" "$body"
    note "updated  $collection: $display"
    echo "$existing"
  else
    api POST "$API/$collection" "$body"
    note "created  $collection: $display"
    gen get "$WORK/resp.json" name
  fi
}

# service_url SERVICE → https://... (env override, else gcloud run services describe)
service_url() {
  local service="$1" var url
  var="$(echo "$service" | tr '[:lower:]-' '[:upper:]_')_URL"
  url="${!var:-}"
  if [[ -z "$url" ]]; then
    if is_dry_run; then
      url="https://${service}.example.invalid"
    else
      url="$(gcloud run services describe "$service" --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
    fi
  fi
  [[ -n "$url" ]] || { echo "Could not resolve the URL of $service (set $var)" >&2; exit 1; }
  echo "${url%/}"
}

# ---------------------------------------------------------------------------
# 1. Notification channel → identity-service relay → Discord
# ---------------------------------------------------------------------------
if ! is_dry_run; then
  list_all notificationChannels
  list_all uptimeCheckConfigs
  list_all alertPolicies
fi

RELAY_URL="${RELAY_URL:-$(service_url identity-service)/v1/internal/alerts/monitoring}"
if is_dry_run; then
  gen channel "$WORK/channel.json" "$RELAY_URL" ""
else
  gcloud secrets versions access latest --secret="$INTERNAL_KEY_SECRET" --project="$PROJECT" >"$WORK/relay_password"
  gen channel "$WORK/channel.json" "$RELAY_URL" "$WORK/relay_password"
  rm -f "$WORK/relay_password"
fi
CHANNEL_ID="$(upsert notificationChannels "$CHANNEL_NAME" "$WORK/channel.json" \
  "displayName,description,labels,userLabels,enabled" webhook_basicauth)"
rm -f "$WORK/channel.json" # holds the password
export CHANNEL_ID

# ---------------------------------------------------------------------------
# 2. Uptime checks (+ one "service down" policy per check)
# ---------------------------------------------------------------------------
# Indexed, not associative (declare -A needs bash 4; macOS ships 3.2): both
# loops below walk the same service list in the same order.
CHECK_IDS=()
for service in "${BACKENDS[@]}" "${FRONTENDS[@]}"; do
  base="$(service_url "$service")"
  if [[ " ${BACKENDS[*]} " == *" $service "* ]]; then
    gen uptime "$WORK/uptime-$service.json" "$service" "$base" backend
  else
    gen uptime "$WORK/uptime-$service.json" "$service" "$base" frontend
  fi
  if ! is_dry_run; then
    existing="$(gen find "$WORK/list-uptimeCheckConfigs.json" "TA uptime: $service")"
    if [[ -n "$existing" ]]; then
      # monitoredResource (the host) is immutable; warn instead of failing on it.
      "$PY" - "$WORK/list-uptimeCheckConfigs.json" "$existing" "$WORK/uptime-$service.json" <<'PY' || true
import json, sys
items = {i["name"]: i for i in json.load(open(sys.argv[1], encoding="utf-8"))}
cur = items[sys.argv[2]].get("monitoredResource", {}).get("labels", {}).get("host")
new = json.load(open(sys.argv[3], encoding="utf-8"))["monitoredResource"]["labels"]["host"]
if cur != new:
    print(f"WARN: {sys.argv[2]} checks host {cur}, wanted {new}; delete it in the Console and re-run", file=sys.stderr)
PY
    fi
  fi
  name="$(upsert uptimeCheckConfigs "TA uptime: $service" "$WORK/uptime-$service.json" \
    "displayName,httpCheck,period,timeout,userLabels")"
  CHECK_IDS+=("${name##*/}")
done

check_index=0
for service in "${BACKENDS[@]}" "${FRONTENDS[@]}"; do
  gen service-down "$WORK/policy-down-$service.json" "$service" "${CHECK_IDS[$check_index]}"
  check_index=$((check_index + 1))
  upsert alertPolicies "TA: service down ($service)" "$WORK/policy-down-$service.json" "" >/dev/null
done

# ---------------------------------------------------------------------------
# 3. Metric and log-match alert policies. No generic "any error log" policy:
#    app errors already reach Discord directly from the services.
# ---------------------------------------------------------------------------
gen 5xx "$WORK/policy-5xx.json"
upsert alertPolicies "TA: 5xx spike" "$WORK/policy-5xx.json" "" >/dev/null
gen scheduler "$WORK/policy-scheduler.json"
upsert alertPolicies "TA: Cloud Scheduler job failed" "$WORK/policy-scheduler.json" "" >/dev/null
gen migration "$WORK/policy-migration.json"
upsert alertPolicies "TA: DB migration job failed" "$WORK/policy-migration.json" "" >/dev/null
gen crash "$WORK/policy-crash.json"
upsert alertPolicies "TA: container crash loop" "$WORK/policy-crash.json" "" >/dev/null

# ---------------------------------------------------------------------------
echo
echo "Cloud Monitoring setup for project $PROJECT$(is_dry_run && echo ' (DRY RUN — nothing changed)'):"
sed 's/^/  /' "$WORK/summary"
echo "  relay: $RELAY_URL"
