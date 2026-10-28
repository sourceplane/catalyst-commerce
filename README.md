# catalyst-commerce

[BigCommerce's Catalyst](https://github.com/bigcommerce/catalyst) (MIT, the
storefront Vercel lists as Catalyst by BigCommerce) — home, categories,
brands, faceted search, product pages with options and variants, a cart,
the store's checkout, accounts, orders and wish lists, a blog and gift
certificates, in several languages, every BigCommerce read cached in Next's
data cache — running on **Cloudflare Workers + Static Assets** through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), with the data
cache in an **R2 bucket** and its route lookups in a **KV namespace**, both
provisioned by Terraform through [Orun](https://github.com/sourceplane/orun),
and the tag cache and revalidation queue in **Durable Objects** the Worker
itself exports, and packaged as an
**Orun baseline**: one command takes a new storefront from nothing to live on
stage and prod, in its own repository, under its own name — in ONE landing.

A fresh build needs no BigCommerce store: until its owner connects one, `/`
says "Connect your BigCommerce store" and every other page goes there —
never a 500. The owner connects a store by setting its hash and a storefront
token (and channel) as Orun secrets and redeploying. The account must be on **Workers Paid** (the Worker
is about 3.4 MiB gzipped). See
[`specs/epics/catalyst-commerce`](specs/epics/catalyst-commerce/README.md) for the design, the
milestones and the as-built status.

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/catalyst-commerce
cd catalyst-commerce
orun new --blueprint repo-blueprint.yaml --out ~/sites/acme-shop --run-hooks --resume \
  --set reponame=acme-shop --set productname="Acme Shop" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`catalyst-commerce` → Build). Two phases: **`01-product`** creates the repository and
lands the whole product as ONE pull request — intent, CI, tooling, the R2
root, the storefront and its tests — and one convergence applies the R2
bucket on stage and prod and then deploys the storefront bound to it;
**`02-docs`** records the live deployment from probed facts.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **product only** — the app, its R2 and KV roots, its
tests, its CI, its tooling, a README of its own and its operating contract —
renamed throughout to the product's name, repository, Cloudflare Worker and
bucket and namespace names. None of this repository's machinery ships. Its
owner then connects a BigCommerce store with two Orun secrets and a redeploy
(the product's README, "Connecting BigCommerce"); the card asks for nothing of
BigCommerce's, because the platform does not broker it.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The product's README and context pack | `.baseline/product/README.md`, `ai/context/` |
| The baseline's tests: contract, wiring, leak, offline bootstrap, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The storefront's routes: `/[locale]/…`, `/api/auth`, `/api/health`, `/sitemap.xml`, `/robots.txt` | `apps/web/app` |
| The store's fallback name | `apps/web/lib/site.ts` (`SITE_NAME`) |
| Whether a store is connected; the page that says how to connect one | `apps/web/lib/bigcommerce-connection.ts`, `apps/web/app/connect-store`, `apps/web/proxy.ts` |
| The GraphQL client and the queries | `packages/client`, `apps/web/client` |
| BigCommerce's Storefront schema the types are generated from | `apps/web/bigcommerce.graphql` |
| The Worker entry and the generated session key | `apps/web/worker.ts`, `apps/web/lib/auth-secret.ts` |
| Workers build, cache bindings and deploy contract | `apps/web/next.config.ts`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ the committed `wrangler.jsonc`), `component.yaml` |
| The R2 bucket and the KV namespace (stage, prod) | `infra/terraform/cloudflare-r2`, `infra/terraform/cloudflare-kv` |
| The wrangler renderer and the Worker-secrets step | `tooling/wire` |
| Tests | `apps/web` (upstream's 286-test vitest suite), `tests/web` (the port's seams) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # GraphQL types + next build --webpack + opennextjs-cloudflare build → apps/web/.open-next
```

```bash
pnpm --filter @app/web dev        # http://localhost:3000, Next's dev server (Node 24: URLPattern)
pnpm --filter @app/web preview    # wrangler dev over the built Worker: local R2, KV and Durable Objects
```

With no store hash and token both serve the "connect your BigCommerce store"
page. To run against a store, put `BIGCOMMERCE_STORE_HASH` and
`BIGCOMMERCE_STOREFRONT_TOKEN` in the shell you build from and in
`apps/web/.dev.vars`. Offline, the e2e's stand-in answers every query from
the schema:
`node testing/lib/fake-bigcommerce.mjs --schema apps/web/bigcommerce.graphql --graphql apps/web --port 4010`,
with `BIGCOMMERCE_GRAPHQL_API_ORIGIN=http://127.0.0.1:4010` beside the store's settings.

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Next.js hosting (SSR, server actions, route handlers, the proxy) | One Cloudflare Worker (`worker.ts` over `.open-next/worker.js`) + Static Assets (`ASSETS`) |
| Data Cache entries | The R2 bucket bound as `NEXT_INC_CACHE_R2_BUCKET` |
| `revalidateTag` | A sharded Durable Object tag cache (`NEXT_TAG_CACHE_DO_SHARDED`) consulted on every cache read |
| Stale-while-revalidate | A Durable Object queue (`NEXT_CACHE_DO_QUEUE`) that re-reads stale entries through the Worker's `WORKER_SELF_REFERENCE` binding |
| Vercel Runtime Cache (route lookups) | Catalyst's own KV adapter, the namespace bound as `CATALYST_ROUTES_KV` |
| `AUTH_SECRET` | Generated by the Worker and kept in KV; the Orun secret `AUTH_SECRET` wins |
| `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_STOREFRONT_TOKEN`, `BIGCOMMERCE_CHANNEL_ID` | Optional Orun secrets, read by the build and set as Worker secrets by the deploy — and, unset, the "connect your BigCommerce store" page instead of a failed build |
| The GraphQL schema generated from the live store | BigCommerce's published Storefront schema, committed (`apps/web/bigcommerce.graphql`) |
| `NEXTAUTH_URL` | Each environment's `SITE_URL`, else its workers.dev URL, set by the build |
| Vercel Web Analytics, Speed Insights | Off unless the build runs on Vercel |
| Deploy on push | Orun applies the bucket and the namespace and deploys `<repo>-web-{stage,prod}` on merge to `main` (`apps/web/component.yaml`) |
| "Deploy with Vercel" (clone the template) | `orun new --blueprint repo-blueprint.yaml` — a new repository, branded, deployed |

Partial prerendering is off: `@opennextjs/cloudflare` 1.20 cannot run Next 16's
Cache Components on workerd yet (a Cache Components page answers 500 and then
hangs — opennextjs-cloudflare#1450), so the storefront keeps upstream's
`"use cache"` reads through `experimental.useCache` and renders every route at
request time. The epic's [IMPLEMENTATION-STATUS](specs/epics/catalyst-commerce/IMPLEMENTATION-STATUS.md)
has the evidence.

## How the bucket reaches the Worker

```
infra/terraform/cloudflare-r2 ──apply (r2-data token)──► orun secret WIRING_CLOUDFLARE_R2 (stage, prod)
                                               │   (each deploy resolves it as it starts;
                                               │    a missing one fails the lane)
                                               ▼
apps/web  dependsOn cloudflare-r2 (enforced on main) · secretEnv WIRING_CLOUDFLARE_R2_<ENV>
  build:  tooling/wire/live.mjs → wrangler.jsonc with the environment's bucket name
          (dev, verify-only, renders the fixture) → next build → opennextjs-cloudflare
  deploy: workers-deploy token → <repo>-web-<env>, its Durable Objects migrated on first deploy
```

`wrangler.jsonc` is committed as the fixture render of
`wrangler.template.jsonc`, because the deploy lane's `verify-app-structure`
step checks the config exists before it builds; `testing/e2e.test.sh` fails
if the two disagree.

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the R2 and KV roots planned for stage and prod, the storefront built and dry-deployed per environment; they neither lint nor run the tests, which `baseline.yml`'s e2e tier runs before every tag), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone runs and nothing waits for it (the landing checked its commit in the box); a merge applies the R2 bucket, then deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests, the wiring path, the blueprint read by the pinned orun, the leak gate, the offline bootstrap with the product's own plan, the product built in the job tree, dry-deployed and served as born (asking for its store), then built again with a stand-in Saleor connected and browsed — its cache reused and revalidated by a signed webhook | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |
