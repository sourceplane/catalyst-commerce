# catalyst-commerce — implementation status

| Milestone | State | Landed |
|---|---|---|
| CA0 — the spec | ✅ | CA-1 |
| CA1 — the storefront on Workers | ✅ | CA-2 |
| CA2 — a baseline | ✅ | CA-3, tagged `baseline-v1` |

Proven offline in Baseline CI (every tier); not yet live (CA-A). Upstream:
bigcommerce/catalyst at `6faa4b5` (`@bigcommerce/catalyst-core` 1.13.1,
MIT): `core/` → `apps/web`, `packages/client` and
`packages/eslint-config-catalyst` → `packages/`.

## Departures from the upstream template

Everything not listed here is the template as it is at `6faa4b5`.

| # | What | Why |
|---|---|---|
| 1 | `core/` is `apps/web` (`@app/web`) of this workspace; `packages/catalyst`, `create-catalyst` and `deployment-preview-action` (the CLI and BigCommerce-hosting tooling) and `core/.github` (its preview-deployment workflow) not carried | The reference's shape; a site deploys through Orun |
| 2 | Next.js `~16.3.4` → 16.3.8; `next build --webpack`, then `opennextjs-cloudflare build` | @opennextjs/cloudflare 1.20.11 needs `>=16.3.8`; with Turbopack its middleware bundle cannot resolve `@opentelemetry/api` |
| 3 | `next.config.ts`: `output: 'standalone'`, the trace root at the workspace root, `@opentelemetry/api` traced whole; `open-next.config.ts` (R2 incremental cache, Durable Object tag cache and queue); `wrangler.template.jsonc` (→ `wrangler.jsonc`) with `CATALYST_ROUTES_KV`, `AUTH_TRUST_HOST` | OpenNext's build; the commerce baseline's caches; Catalyst's own KV adapter |
| 4 | `worker.ts` wraps OpenNext's Worker and hands Auth.js its key: `AUTH_SECRET`, else one generated and kept in KV (`lib/auth-secret.ts`) | Nothing to type; no database to generate it in |
| 5 | `instrumentation.ts` imports `@vercel/otel` only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set | At module scope it fails every request on workerd |
| 6 | The schema committed (`bigcommerce.graphql`, BigCommerce's published Storefront schema from bigcommerce/checkout-sdk-js, MIT); `scripts/generate.cjs` reads it, `--schema-from-store` (`generate:schema`) refreshes it | Types, build, lint and tests need no store |
| 7 | No store: `lib/bigcommerce-connection.ts`; `next.config.ts` writes default settings, the client defaults to channel 1, `sitemap.xml`/`robots.txt`/`favicon.ico` answer without the store, the proxy rewrites `/` to `app/connect-store` and redirects the rest, the `[locale]` layout redirects too | A storefront deploys before its owner has a store, never a 500 |
| 8 | `lib/site.ts` (`SITE_NAME`), the title of the connect page and the fallback store name (`storeName \|\| SITE_NAME`, upstream `?? ''`) | One rename seam |
| 9 | `robots.txt`'s `parseUrl` accepts a full origin (each environment's `NEXTAUTH_URL`) | Upstream turned a full URL into `localhost` |
| 10 | `app/api/health` added | The deploy's smoke and the record's probe |
| 11 | `packages/client`: `BIGCOMMERCE_GRAPHQL_API_ORIGIN` overrides the store's GraphQL origin | A stand-in store for the tests; never set in a deploy |
| 12 | `engines.node` `>=24` → `>=22`; a `URLPattern` polyfill in the vitest setups (only where the global is missing) | The lanes run Node 22; the Worker (workerd) has `URLPattern` natively; `next dev` still needs Node 24 (CA-H) |
| 13 | The lockfile seeded from upstream's (its `core` importer at `apps/web`); typescript-eslint pinned to upstream's 8.28.0 (`overrides`) | Upstream's tested resolutions; newer rules its sources were never linted with |
| 14 | `apps/web/LICENSE` (upstream's root MIT licence) | The storefront's licence ships with it |
| 15 | `packages/client/.eslintrc.cjs` loads `@bigcommerce/eslint-config/patch`, as `apps/web`'s already does | Its plugins then resolve from the shared config's own (ESLint 8) dependencies, not the workspace's hoisted ESLint 9 copy of typescript-eslint, which crashes ESLint 8 |
| 16 | `apps/web`'s `lint` gives ESLint a 4 GiB heap | Type-aware linting of the whole storefront exceeds Node's default and aborts |

## Departures from the reference

| # | What | Why |
|---|---|---|
| 1 | A second Terraform root, `cloudflare-kv` (kv-redis-starter's), applied beside the R2 root; the Worker depends on both | Catalyst's route cache and the session key |
| 2 | The store's hash, token and channel and `AUTH_SECRET` are optional Orun secrets the build reads and the deploy sets as Worker secrets (`tooling/wire/worker-secrets.mjs`, clerk-auth-starter's) | The build reads the store's settings; the Worker reads the store on every request |
| 3 | `packages/` placed by its own module (`catalyst-packages`) | The storefront's workspace packages |
| 4 | The e2e's stand-in is BigCommerce's (`testing/lib/fake-bigcommerce.mjs`), and a canary storefront token proves no build artifact carries it | The store this storefront reads |

## Verified

- `pnpm typecheck`, `lint`, `test` (`apps/web` 286 — upstream's own suite —
  and `tests/web` 24) and `build` green with no store; the Worker is
  3.36 MiB gzipped (17.2 MiB raw) — Workers Paid.
- Every local tier on orun v2.89.0: manifest, phases, coverage, rebrand,
  retouch, bootstrap-defer, wire, component docs, blueprint `--status`, leak,
  placement, e2e.
- Spike (`~/orunbase/spikes`, not in this repository): under `wrangler dev` a
  second visit read BigCommerce zero times; after the revalidation window
  the stale page was served and re-read in the background, and the next
  visit showed the change; unconnected, every path redirected to `/` with
  zero reads; Auth.js signed with the key generated in KV.
