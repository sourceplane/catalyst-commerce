#!/usr/bin/env bash
# THE LEAK GATE — what a site carries, and what stays in the factory.
#
# A site built from this baseline is somebody's store, not a copy of this
# repository. It gets the product: the storefront, its R2 root, its tests, its CI,
# its tooling, its README and its two context pages. It does NOT get the
# factory: the blueprints, the bootstrap and rebrand tooling, the test gates,
# the task contracts and identity under `.baseline/`, this repository's own
# epic and task tree, or BOOTSTRAP.md — and no file it does get may so much
# as NAME one of those paths, because in the product they do not exist.
#
# This asks orun to DERIVE the placement — every file every phase would write
# — and gates that set and the sources it is copied from. Derivation runs no
# hooks, contacts nothing and writes nothing. testing/placement.test.sh gates
# the same rules over a tree that is actually placed and branded.
#
# Needs: orun + python3. No network, no credential.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

command -v orun >/dev/null || { echo "leak.test.sh needs orun on PATH" >&2; exit 1; }

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

echo "── deriving what every phase would place"
sets=()
while IFS=$'\t' read -r k v; do sets+=( --set "$k=$v" ); done < <(
  python3 - "$here/fixtures/acme.json" <<'PY'
import json, sys
for k, v in json.load(open(sys.argv[1])).items():
    if not k.startswith("_"):
        print(f"{k}\t{'true' if v is True else 'false' if v is False else v}")
PY
)
orun new --blueprint "$root/repo-blueprint.yaml" --status --json \
  --out "$scratch/empty" "${sets[@]}" > "$scratch/status.json"

# intent.yaml's `work:` block names this repository's epic and task tree; the
# product's copy has it stripped by a 01-product hook before it lands, so the
# source is gated as the product receives it.
cp "$root/intent.yaml" "$scratch/intent.yaml"
node "$root/tooling/bootstrap/work-tree.mjs" --strip --file "$scratch/intent.yaml" >/dev/null

python3 - "$scratch/status.json" "$root" "$scratch/intent.yaml" <<'PY'
import json, pathlib, re, sys
import yaml

status = json.load(open(sys.argv[1]))
root = pathlib.Path(sys.argv[2])
stripped_intent = pathlib.Path(sys.argv[3])
problems = []
def bad(m): problems.append(m)

# Against an empty output directory every file a phase places is "missing", so
# the union of those lists IS the site's file set.
placed = sorted({f for ph in status["phases"] for f in (ph.get("missing") or [])})
if len(placed) < 50:
    sys.exit(f"only {len(placed)} files derived — the tree is not a site")

# ── the context pack, exactly ─────────────────────────────────────────────
ALLOWED_AI = {"ai/context/deployment.md", "ai/context/operations.md"}
shipped_ai = {p for p in placed if p.startswith("ai/")}
for extra in sorted(shipped_ai - ALLOWED_AI):
    bad(f"{extra} ships to the site and is this repository's own state")
for missing in sorted(ALLOWED_AI - shipped_ai):
    bad(f"{missing} is declared a product file and would not ship")

# ── the factory never ships ───────────────────────────────────────────────
NEVER = (".baseline/", "specs/", "tasks/", "testing/", "hooks/", "docs/phases/",
         "tooling/rebrand/", "tooling/bootstrap/", ".github/workflows/baseline.yml",
         ".github/workflows/tag.yml", "BOOTSTRAP.md", "repo-blueprint.yaml",
         "blueprint.yaml", "flows/", "agents/")
for p in placed:
    for never in NEVER:
        if p == never or p.startswith(never):
            bad(f"{p} would ship — it is the factory, not the site")

# ── nothing local and nothing built ───────────────────────────────────────
LOCAL = re.compile(r"(^|/)(\.env(\.[^/]*\.local|\.local)?|\.env\.configurator\.local|\.dev\.vars(\..*)?|"
                   r"node_modules|\.next|\.open-next|\.wrangler|\.turbo|\.orun|\.terraform|next-env\.d\.ts|"
                   r"[^/]*\.tsbuildinfo|[^/]*\.tfstate(\.backup)?|\.terraform\.lock\.hcl)(/|$)"
                   # what every build, type check, lint and test generates: the
                   # GraphQL types (from bigcommerce.graphql), the store settings
                   # next.config.ts writes, next-intl's message declarations
                   r"|^apps/web/bigcommerce-graphql\.d\.ts$|^apps/web/build-config/build-config\.json$"
                   r"|^apps/web/messages/[^/]*\.d\.json\.ts$|^apps/web/client/generated/")
for p in placed:
    if LOCAL.search(p):
        bad(f"{p} would ship — a local or built file of whoever ran the bootstrap")

# ── the site's README, not this repository's ──────────────────────────────
if "README.md" not in placed:
    bad("README.md would not ship")
for must in (".github/workflows/ci.yml",
             "apps/web/component.yaml", "tests/web/component.yaml",
             ".rebrand/values.json", "apps/web/.env.example",
             # the wiring path: the template, its fixture, the committed render
             # the deploy lane checks for, and the renderer the build calls
             "apps/web/wrangler.template.jsonc", "apps/web/wiring.fixture.json",
             "apps/web/wrangler.jsonc", "tooling/wire/live.mjs", "tooling/wire/render.mjs",
             # the Worker secrets the deploy sets from the store's Orun secrets
             "tooling/wire/worker-secrets.mjs",
             # the R2 and KV roots the storefront binds
             "infra/terraform/cloudflare-r2/component.yaml",
             "infra/terraform/cloudflare-r2/terraform/main.tf",
             "infra/terraform/cloudflare-r2/terraform/adopt.tf",
             "infra/terraform/cloudflare-kv/component.yaml",
             "infra/terraform/cloudflare-kv/terraform/main.tf",
             "infra/terraform/cloudflare-kv/terraform/adopt.tf",
             # the storefront's own packages: its GraphQL client and lint config
             "packages/client/package.json", "packages/client/src/client.ts",
             "packages/eslint-config-catalyst/package.json",
             # the Next.js cache on Workers, the Worker entry that hands Auth.js
             # its key, and the schema every build, type check and test
             # generates the storefront's types from (no store needed)
             "apps/web/open-next.config.ts", "apps/web/next.config.ts", "apps/web/worker.ts",
             "apps/web/lib/auth-secret.ts", "apps/web/bigcommerce.graphql",
             "apps/web/scripts/generate.cjs",
             # a storefront with no BigCommerce store connected: the seam
             # everything asks, the proxy that sends every page to `/`, the page
             # that says how to connect one, and the deploy's health probe
             "apps/web/lib/bigcommerce-connection.ts", "apps/web/proxy.ts",
             "apps/web/app/connect-store/page.tsx", "apps/web/app/api/health/route.ts",
             # the storefront's name seam and its licence (MIT)
             "apps/web/lib/site.ts", "apps/web/LICENSE"):
    if must not in placed:
        bad(f"{must} would not ship, and a site needs it")

# ── no shipped file names the factory ─────────────────────────────────────
# Read from the SOURCE each placed file is copied from (the module's `from`).
# A product's file that points a reader at `testing/` or `repo-blueprint.yaml`
# points at nothing: those paths do not exist in the product.
FACTORY = re.compile(r"repo-blueprint|BOOTSTRAP\.md|(?<![\w-])(testing|specs|tasks|docs/phases|"
                     r"tooling/rebrand|tooling/bootstrap)/|(?<![\w/])\.baseline/")
bp = yaml.safe_load((root / "repo-blueprint.yaml").read_text())
sources = []
for m in bp.get("modules") or []:
    if m.get("mode") != "copy":
        continue
    frm, to = (m.get("from") or "").rstrip("/"), (m.get("to") or "").rstrip("/")
    for p in placed:
        if p == to or p.startswith(to + "/"):
            sources.append((p, frm + p[len(to):]))
scanned = 0
for shipped, src in sources:
    path = stripped_intent if src == "intent.yaml" else root / src
    try:
        text = path.read_text()
    except (UnicodeDecodeError, FileNotFoundError):
        continue
    scanned += 1
    for n, line in enumerate(text.splitlines(), 1):
        if FACTORY.search(line):
            bad(f"{shipped} (from {src}:{n}) names a factory path: {line.strip()[:90]}")
if scanned < 40:
    bad(f"only {scanned} shipped sources scanned for factory paths — this check has gone blind")

# ── THE SLUG, ONLY AS THE IDENTITY ────────────────────────────────────────
# The rebrand renames EVERY standalone `catalyst-commerce` to the product's slug
# — in prose too ("the catalyst-commerce storefront" ships as "the acme-shop
# storefront") — and its Pascal form `CatalystCommerce` is residue the rebrand
# fails on. So a shipped source spells them only in the identity forms the
# rename is meant to rewrite. The storefront's own words, `Catalyst` and
# `BigCommerce`, are not this identity (its packages, its CATALYST_* and
# BIGCOMMERCE_* settings, the licensor), and are not looked for. Read from the sources, as above;
# testing/placement.test.sh runs `rebrand --verify` over a placed tree.
IDENTITY_FORMS = re.compile(
    r"catalyst-commerce-web\b|secret://catalyst-commerce/catalyst-commerce/|github\.com/sourceplane/catalyst-commerce\b"
    r"|catalyst-commerce\.example\.com|\b(dev|stg|prod)-catalyst-commerce-(dev|stage|prod)\b"
    r"|^\s*(name|repo|displayName): catalyst-commerce\s*$|\"name\": \"catalyst-commerce\"|default = \"catalyst-commerce\""
    r"|^# catalyst-commerce(\s|$)"
)
WORD = re.compile(r"\bcatalyst-commerce\b|CatalystCommerce")
words = 0
for shipped, src in sources:
    path = stripped_intent if src == "intent.yaml" else root / src
    try:
        text = path.read_text()
    except (UnicodeDecodeError, FileNotFoundError):
        continue
    for n, line in enumerate(text.splitlines(), 1):
        rest = IDENTITY_FORMS.sub("", line)
        if WORD.search(rest):
            words += 1
            bad(f"{shipped} (from {src}:{n}) spells the slug outside an identity form "
                f"(the rename would rewrite it; say store or storefront): {line.strip()[:80]}")
for shipped, src in [("README.md", ".baseline/product/README.md")]:
    for n, line in enumerate((root / src).read_text().splitlines(), 1):
        if WORD.search(IDENTITY_FORMS.sub("", line)):
            bad(f"{shipped} (from {src}:{n}) spells the slug outside an identity form: {line.strip()[:80]}")

# ── THE STORE'S NAME, ONLY AT ITS SEAM ────────────────────────────────────
# The rename rewrites the store's name at ONE line (SITE_NAME, lib/site.ts)
# and has no rule for it anywhere else, and the leftover sweep does not look
# for it (it is not an identity form). Each use reads the seam (the
# storefront's title fallback, the connect page). A shipped source under
# apps/web that spells it again would ship this baseline's store name in
# somebody else's store.
SEAM = "apps/web/lib/site.ts"
STORE_NAME = re.compile(r"Catalyst Store\b")
for shipped, src in sources:
    if not src.startswith("apps/web/"):
        continue
    try:
        text = (root / src).read_text()
    except (UnicodeDecodeError, FileNotFoundError):
        continue
    for n, line in enumerate(text.splitlines(), 1):
        if src == SEAM and line.startswith("export const SITE_NAME = "):
            continue
        if STORE_NAME.search(line):
            bad(f"{shipped} (from {src}:{n}) spells the store's name outside its seam ({SEAM}): {line.strip()[:80]}")

# ── PROVENANCE, which rebrand has no rule for ─────────────────────────────
# Not a search for this baseline's name: the rebrand rewrites that, and this
# gate reads the sources before it runs. What the rebrand cannot rewrite is a
# sentence about where the site CAME FROM, or one about being a baseline.
PROVENANCE = re.compile(
    r"\bfork(ed)? (of|from)\b|\bbaseline (repo|repository|commit|tag)\b|\bthis baseline\b"
    r"|BOOTSTRAP\.md|repo-blueprint|specs/epics|\.baseline/",
    re.I,
)
SOURCES = {"README.md": ".baseline/product/README.md",
           "ai/context/operations.md": "ai/context/operations.md",
           "ai/context/deployment.md": "ai/context/deployment.md"}
for shipped, src in SOURCES.items():
    for n, line in enumerate((root / src).read_text(errors="replace").splitlines(), 1):
        if PROVENANCE.search(line):
            bad(f"{shipped} (from {src}:{n}) tells the site about the factory: {line.strip()[:80]}")

if problems:
    print("FAIL: the site would carry the baseline:", file=sys.stderr)
    for p in problems:
        print(f"  - {p}", file=sys.stderr)
    sys.exit(1)

print(f"   {len(placed)} files derived across every phase")
print(f"   ai/context is exactly {len(ALLOWED_AI)} declared file(s); none of the "
      f"{len(NEVER)} factory paths; nothing local or built; no provenance prose")
print(f"   {scanned} shipped sources name no factory path")
PY

echo "leak.test.sh: ok"
