#!/usr/bin/env bash
# Render the store's LIVE-DEPLOYMENT documentation from verified state.
# Called by phase 02-docs as a `run:` hook (and safe to run by hand, from the
# site's checkout). Idempotent: the generated file and the README section are
# fully re-rendered on every run, so re-running after a redeploy or a custom
# domain refreshes them.
#
#   hooks/render-deployment-docs.sh <out> <workspace> <baseline-dir>
#
# What it writes (in <out>):
#   ai/context/deployment.md   — REGENERATED: URLs with live probe results (and
#                                whether the Worker itself answered, and
#                                whether a BigCommerce store is connected),
#                                identity, the R2 wiring, and the secrets the
#                                deployment uses BY NAME
#   ai/context/operations.md   — healed from the baseline's copy if absent
#                                (the static operating contract; never rewritten)
#   README.md                  — the section between <!-- 02-docs:begin/end -->
#                                is replaced (appended after the title if the
#                                README predates the markers)
#
# No secret VALUE is ever read or written here — secrets are named, not read.
#
# IT ASKS THE PLATFORM NOTHING. The record used to carry the workspace's slug,
# its secrets listed per rung and its integrations — five CLI calls, one after
# another, from the build box — and all of it is what the console shows live
# and this file could only show as it was the day it was written. The record
# keeps what the repository is the right place for: the identity the code
# names, what answered at the URLs, and where to look for the rest.
set -euo pipefail

out="${1:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"
ws="${2:-}"
L="${3:?usage: render-deployment-docs.sh <out> <workspace> <baseline-dir>}"

cd "$out"
vals=".rebrand/values.json"
[ -f "$vals" ] || { echo "render-docs: $vals missing — is this a scaffolded site?" >&2; exit 1; }
val() { python3 -c "import json,sys;print(json.load(open('$vals')).get(sys.argv[1],'') or '')" "$1"; }

repo="$(val reponame)"
brand="$(val brandSlug)"; [ -n "$brand" ] || brand="$repo"
sub="$(val subdomain)"; [ -n "$sub" ] || sub="your-workers-subdomain"
[ -n "$ws" ] || ws="$(sed -n 's/^[[:space:]]*workspace:[[:space:]]*\([^[:space:]#]*\).*/\1/p' intent.yaml | head -1)"
[ -n "$ws" ] || ws="?"

# CI lane pin (what version the deploy lanes run).
lanepin="$(sed -n 's/^ *version: *\(v[0-9.]*\) *$/\1/p' .github/workflows/ci.yml 2>/dev/null | head -1)"
[ -n "$lanepin" ] || lanepin="?"

# /api/health is answered by the Worker alone — no static file has that path —
# and says whether a BigCommerce store is connected: `{"ok":true,"bigcommerce":
# "connected"|"not-connected"}`. `/` answers 200 with "Connect your BigCommerce
# store" before one is connected and 308s to the store's home after. curl
# emits the -w format even on connection failure (000) — capture, don't
# append, or a failed probe reads "000000".
probe() { # URL → "<code> <worker|no-worker> <connected|not-connected|?>"
  local health code worker bigcommerce
  health="$(mktemp)"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1/" 2>/dev/null)" || true
  curl -s -o "$health" --max-time 20 "$1/api/health" 2>/dev/null || true
  if grep -q '"ok":true' "$health" 2>/dev/null; then worker=worker; else worker=no-worker; fi
  bigcommerce="$(sed -n 's/.*"bigcommerce":"\([a-z-]*\)".*/\1/p' "$health" 2>/dev/null | head -1)"
  printf '%s %s %s' "${code:-000}" "$worker" "${bigcommerce:-?}"
  rm -f "$health"
}
badge() { # "<code> <worker|no-worker> <connected|not-connected|?>"
  local code worker bigcommerce
  read -r code worker bigcommerce <<<"$1"
  case "$code" in
    2*|3*)
      if [ "$worker" != worker ]; then echo "answering $code, /api/health not answered by the Worker"
      elif [ "$bigcommerce" = connected ]; then echo "LIVE ($code) — BigCommerce store connected"
      else echo "LIVE ($code) — no BigCommerce store connected yet"; fi ;;
    000) echo "unreachable" ;;
    *) echo "answering $code" ;;
  esac
}

stage_url="https://${brand}-web-stage.${sub}.workers.dev"
prod_url="https://${brand}-web-prod.${sub}.workers.dev"
rows=""
for pair in "stage|$stage_url" "prod|$prod_url"; do
  env="${pair%%|*}"; url="${pair#*|}"
  rows+="| storefront (${env}) | ${url} | $(badge "$(probe "$url")") |"$'\n'
done

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Heal the static operating contract when the site predates it.
mkdir -p ai/context
if [ ! -f ai/context/operations.md ] && [ -f "$L/ai/context/operations.md" ]; then
  cp "$L/ai/context/operations.md" ai/context/operations.md
  git add ai/context/operations.md 2>/dev/null || true
  node "$L/tooling/rebrand/rebrand.mjs" --values "$vals" --allow-dirty >/dev/null 2>&1 || true
  echo "render-docs: healed ai/context/operations.md"
fi

cat > ai/context/deployment.md <<EOF
# ${repo} — live deployment manifest

> GENERATED by the \`02-docs\` phase on ${now}; re-run it to refresh
> (idempotent; see [operations.md](operations.md)). Hand-edits here are
> overwritten. No secret values appear in this file — secrets are named only.

## Identity

| | |
|---|---|
| repository / project slug | \`${repo}\` |
| Orun workspace | \`${ws}\` |
| declared in | \`intent.yaml\` → \`execution.state.workspace\` |
| Workers | \`${brand}-web-stage\`, \`${brand}-web-prod\` on \`${sub}.workers.dev\` |
| R2 buckets (the Next.js data cache) | \`stg-${repo}-stage\`, \`prod-${repo}-prod\` (\`infra/terraform/cloudflare-r2\`); their names reach the Workers as \`WIRING_CLOUDFLARE_R2\` on each environment |
| KV namespaces (route lookups, the generated auth key) | \`stg-${repo}-app-kv-stage\`, \`prod-${repo}-app-kv-prod\` (\`infra/terraform/cloudflare-kv\`); their ids reach the Workers as \`WIRING_CLOUDFLARE_KV\` on each environment |
| CI lane CLI pin | orun \`${lanepin}\` (\`.github/workflows/ci.yml\`) |

## Public URLs (probed ${now})

| surface | URL | status |
|---|---|---|
${rows}
The \`dev\` environment is verify-only by design — no deployed URL, no
bucket and no namespace. Until a BigCommerce store is connected (the README's
"Connecting BigCommerce"), each storefront's \`/\` says "Connect your
BigCommerce store" and every other page goes there. The account must be on
Workers Paid (the Worker is about 3.4 MiB gzipped).

## Secrets (names only)

| secret | where | what it is |
|---|---|---|
| \`CLOUDFLARE_API_TOKEN\` | the workspace | BROKERED from its Cloudflare connection (\`workers-deploy\`): deploys the Worker and its static assets |
| \`CLOUDFLARE_R2_TOKEN\` | the workspace | BROKERED (\`r2-data\`): applies the R2 bucket — the deploy token carries no R2 |
| \`CLOUDFLARE_ACCOUNT_ID\` | the workspace | the connection's account id — a fact, not a credential |
| \`WIRING_CLOUDFLARE_R2\` | \`${repo}\` on stage and on prod | written by the R2 root's apply: the bucket's name, not a credential |
| \`WIRING_CLOUDFLARE_KV\` | \`${repo}\` on stage and on prod | written by the KV root's apply: the namespace's id, not a credential |
| \`BIGCOMMERCE_STORE_HASH\`, \`BIGCOMMERCE_STOREFRONT_TOKEN\`, \`BIGCOMMERCE_CHANNEL_ID\` | \`${repo}\` on stage and on prod, set by the owner (optional) | the BigCommerce store the storefront sells from — the deploy sets them on the Worker too |
| \`AUTH_SECRET\` | \`${repo}\` on stage and on prod, set by the owner (optional) | the key sessions are signed with; without it the Worker generates one and keeps it in its KV namespace |

Brokered secrets are minted per run, so no long-lived value is at rest. What
the workspace holds right now (every secret by name, and its integrations
and their health) is on the console's Secrets and Integrations pages for
\`${ws}\`. The store's settings and an owner's AUTH_SECRET are also Worker
secrets on the Workers above, set from these by every deploy.

## How this deployment changes

Merges to \`main\` converge automatically: CI plans the changed components and
runs each lane with \`orun run --remote-state\` against the workspace above —
the R2 bucket and the KV namespace first, then the storefront. See [operations.md](operations.md) for
the full operating contract.
EOF
echo "render-docs: wrote ai/context/deployment.md"

python3 - <<'PY'
import re
begin, end = "<!-- 02-docs:begin -->", "<!-- 02-docs:end -->"
body = f"""{begin}
This store is **live**. Verified URLs, identity and the secrets it uses are
recorded in [ai/context/deployment.md](ai/context/deployment.md) (re-rendered
by the `02-docs` phase); how it deploys and how to operate it:
[ai/context/operations.md](ai/context/operations.md).
{end}"""
s = open("README.md").read()
if begin in s and end in s:
    s = re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _m: body, s, count=1, flags=re.S)
else:
    lines = s.splitlines(keepends=True)
    at = 1
    while at < len(lines) and lines[at].strip() == "":
        at += 1
    lines.insert(at, f"\n## Live deployment\n\n{body}\n")
    s = "".join(lines)
open("README.md", "w").write(s)
print("render-docs: README live-deployment section rendered")
PY
echo "render-docs: done"
