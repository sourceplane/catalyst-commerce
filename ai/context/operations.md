# catalyst-commerce — operating contract (for humans and agents)

This is the standing guide to how this store is deployed and operated.
Instance facts (live URLs, workspace, whether a BigCommerce store is
connected, the secrets it uses) live in [deployment.md](deployment.md),
rendered from probed reality by the bootstrap's `02-docs` phase; this file is
the contract that stays true between deployments. It is written to give an
agent with repository read access enough context to reason about and operate
the store without any other source.

## What this system is

A BigCommerce storefront on Cloudflare, expressed as an Orun component-native
desired-state repo. BigCommerce itself — the catalogue, carts, checkout,
orders, customers, payments — is the owner's store, reached over its
Storefront GraphQL API; nothing here runs BigCommerce.

- **`infra/terraform/cloudflare-r2`** — one R2 bucket per deployed
  environment (`stage`, `prod`), applied by Terraform: the storefront's
  Next.js incremental cache. After each apply it publishes a wiring document
  — `{r2_bucket_name}` — as the Orun secret `WIRING_CLOUDFLARE_R2` on that
  environment.
- **`infra/terraform/cloudflare-kv`** — one KV namespace per deployed
  environment, applied by Terraform: the storefront's route-lookup cache and
  where the Worker keeps the session key it generates. After each apply it
  publishes `{app_kv_id, app_kv_title}` as `WIRING_CLOUDFLARE_KV`.
- **`apps/web`** — the storefront: BigCommerce's Catalyst (Next.js) built by
  `@opennextjs/cloudflare` into one Worker plus Static Assets, wrapped by
  `worker.ts` (which hands Auth.js its key). Every page renders per request
  from cached BigCommerce reads: each query carries a revalidation window
  (`DEFAULT_REVALIDATE_TARGET`, an hour by default) and tags, and Next's data
  cache keeps the answers in the bucket (`NEXT_INC_CACHE_R2_BUCKET`); the
  Worker exports two Durable Objects, the tag cache and the revalidation
  queue, and binds the namespace (`CATALYST_ROUTES_KV`) for route, store
  status and locale lookups. Its GraphQL types are generated from
  `apps/web/bigcommerce.graphql` (BigCommerce's published Storefront schema)
  on every build, type check and lint; its GraphQL client is
  `packages/client`.
- **`tests/web`** — the store-name seam, the BigCommerce connection, the
  proxy before a store is connected, the routes that answer without a store,
  `/api/health`, and the generated session key (vitest). The storefront's own
  suite (`apps/web`, upstream's) runs with `pnpm test`. Neither runs in a
  lane: the `dev` lane of `tests/web` installs it and checks its structure,
  so run `pnpm typecheck`, `pnpm lint` and `pnpm test` before you push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, the wrangler
  renderer that turns `wrangler.template.jsonc` plus the wiring documents
  into `wrangler.jsonc`, and the step that sets the store's settings as
  Worker secrets.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and dry-deploy, nothing deploys, and no
bucket or namespace exists for it (its build renders the committed fixture).

The account must be on **Workers Paid**: the Worker is about 3.4 MiB
gzipped, over Workers Free's 3 MiB.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. **The bucket and the namespace before the Worker.** `cloudflare-r2` and
   `cloudflare-kv` apply for the environment, side by side, and publish
   their wiring documents. `apps/web` declares an enforced `dependsOn` on
   both for pushes to `main`, so its deploy starts only after those applies —
   and a job resolves its secrets when it starts, so the documents are there.
4. `apps/web` renders `wrangler.jsonc` from those documents (the real bucket
   name and namespace id) and builds once per environment: `NEXTAUTH_URL`
   (robots.txt's sitemap line) is the environment's `SITE_URL` (intent.yaml)
   or its workers.dev URL, and the store is the environment's
   `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_STOREFRONT_TOKEN` and
   `BIGCOMMERCE_CHANNEL_ID` secrets, when set — the build reads the store's
   settings with them, and `tooling/wire/worker-secrets.mjs` sets them (and
   an owner's `AUTH_SECRET`) as Worker secrets. `wrangler deploy` ships
   `catalyst-commerce-web-<env>` (the Durable Objects are created by the
   config's migration on the first deploy), and a smoke test fetches `/` and
   `/api/health`, which only the Worker answers.
5. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
6. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

On a pull request nothing applies or deploys: the R2 and KV roots plan, the
storefront builds and dry-deploys, and the edges in step 3 are advisory.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "store
  converged"; probe the URLs instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/web`.
- Setting or changing the store's secrets deploys nothing: they are read
  when the storefront builds and set on the Worker by its deploy. Redeploy
  it (below).
- Removing a store secret does not remove it from the Worker: the deploy sets
  the secrets that exist and deletes none. `wrangler secret delete <KEY>
  --name catalyst-commerce-web-<env>` does.
- `wrangler.jsonc` is generated. Edit `wrangler.template.jsonc`, run
  `pnpm run wire:fixture` and commit both; the deploy renders its own
  config from the template, so a stale committed render misleads local work.

## The store

- **No BigCommerce store connected** (no store hash or no storefront token
  for the environment): the build calls nothing; `/` answers 200 with
  "Connect your BigCommerce store"; every other page, the cart, checkout and
  sign-in included, redirects (307) to `/`; `/sitemap.xml` and `/robots.txt`
  answer without a store; `/api/health` answers
  `{"ok":true,"bigcommerce":"not-connected"}`.
- **Connected**: every page reads the store through cached reads; the cart,
  checkout, accounts and orders are the store's; checkout is BigCommerce's
  own (its hosted checkout, at the channel's checkout URL), with the payment
  methods the store has set up; `/api/health` says `connected`.
- **Sessions**: Auth.js, its cookies signed with `AUTH_SECRET` when set
  (an Orun secret, set on the Worker by the deploy), otherwise with the key
  the Worker generated the first time one was needed and keeps in its KV
  namespace under `auth:secret`. Rotating either signs everyone out.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (the
  `workers-deploy` scope: Workers Scripts and KV Storage write) deploys the
  Worker and is what the KV root's Terraform authenticates with;
  `CLOUDFLARE_R2_TOKEN` (the `r2-data` scope: R2 Storage write) is what the
  R2 root's Terraform authenticates with, because the deploy token carries no
  R2; `CLOUDFLARE_ACCOUNT_ID` is the connection fact all of them bind.
  Minted per run from the workspace's Cloudflare connection — no long-lived
  values at rest, nothing to rotate by hand.
- **Wiring**: `WIRING_CLOUDFLARE_R2` and `WIRING_CLOUDFLARE_KV` on `stage`
  and `prod`, written by the roots' applies (lease-published), read by the
  Worker's build as `WIRING_CLOUDFLARE_*_<ENV>`. They hold the bucket's name
  and the namespace's id, not credentials.
- **The store**: `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_STOREFRONT_TOKEN`,
  `BIGCOMMERCE_CHANNEL_ID` and `AUTH_SECRET`, set by the owner per
  environment (all optional), resolved into the build and set as Worker
  secrets by its deploy. The storefront token is read at request time and by
  the build; it is in no build artifact.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.

## Verifying the system

```bash
# the store on each environment (also recorded, probed, in deployment.md)
curl -s https://catalyst-commerce-web-stage.your-workers-subdomain.workers.dev/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://catalyst-commerce-web-prod.your-workers-subdomain.workers.dev/

# the wiring the deploys read, and workspace readiness
orun secrets list --org <ws> --env stage && orun secrets list --org <ws> --env prod
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| change the storefront | edit `apps/web` (its fallback name: `apps/web/lib/site.ts`), merge |
| connect a BigCommerce store | the README's "Connecting BigCommerce": `BIGCOMMERCE_STORE_HASH` and `BIGCOMMERCE_STOREFRONT_TOKEN` (and `BIGCOMMERCE_CHANNEL_ID`) per environment, then redeploy the storefront |
| change a GraphQL query | edit it under `apps/web/client` or beside its page; the build regenerates the types from `apps/web/bigcommerce.graphql` |
| move to the store's current schema | `pnpm --filter @app/web generate:schema` with the store's hash and token in the shell, then `pnpm typecheck`; commit `bigcommerce.graphql` and merge |
| change how long reads are cached | `DEFAULT_REVALIDATE_TARGET` (seconds) as a Worker var or secret; an hour by default |
| rotate the session key | set `AUTH_SECRET` (an Orun secret) and redeploy, or delete `auth:secret` from the environment's KV namespace — either signs everyone out |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| empty the data cache | delete the bucket's `incremental-cache/` objects (and the namespace's route keys) |
| add a binding (D1, another bucket) | a Terraform root under `infra/terraform/` that publishes `WIRING_<ROOT>`, a token in `wrangler.template.jsonc`, its fixture entry, the root in the build's `--components`, the `WIRING_<ROOT>_<ENV>` secretEnv and an enforced `dependsOn` on it in `apps/web/component.yaml` |
| serve a custom domain | attach it to the Worker in Cloudflare and set `SITE_URL` for the environment in `intent.yaml` (README, "Custom domain"), then replace the placeholder `catalyst-commerce.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it |
| add a runtime secret | `wrangler secret put <KEY> --name catalyst-commerce-web-<env>` for the Worker; `orun secrets set <KEY> --org <ws> --env <env>` for a lane |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes follow the same contract that deployed the store: add a
component under `apps/`, `infra/` or `packages/` with a `component.yaml`,
land it as a pull request, and the convergence run applies it. Catalyst's
upstream releases (bigcommerce/catalyst, `@bigcommerce/catalyst-core`) are
merged into `apps/web` and `packages/` by hand; its Makeswift and native
hosting integrations are not wired here.
