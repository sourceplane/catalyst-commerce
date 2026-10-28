# catalyst-commerce

A BigCommerce storefront — home, categories, brands, search with facets,
product pages with options and variants, a cart, BigCommerce's checkout,
customer accounts, orders, addresses and wish lists, a blog, gift
certificates, in several languages — on **Cloudflare Workers + Static
Assets** through [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
built from [BigCommerce's Catalyst](https://github.com/bigcommerce/catalyst)
(MIT — `apps/web/LICENSE`). Every read from BigCommerce is cached in Next's
data cache, in an **R2 bucket** Terraform provisions per environment; the tag
cache and the revalidation queue are **Durable Objects** the Worker itself
exports, and the storefront's route lookups are cached in a **KV namespace**
Terraform provisions beside the bucket.

It is live from its first deploy, before any store is connected: `/` says
**"Connect your BigCommerce store"** and every other page goes there. Once you
give it your store's hash and a storefront token, it sells your products.

The account must be on **Workers Paid**: the Worker is about 3.4 MiB gzipped,
over Workers Free's 3 MiB.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace, whether a BigCommerce store is connected and the secrets the store
uses into [ai/context/deployment.md](ai/context/deployment.md); how the store
deploys and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The storefront's routes: `/[locale]` home, products, categories, brands, search, cart, checkout, account, wish lists, blog, gift certificates, sign-in; `/api/auth` (Auth.js), `/api/health`, `/sitemap.xml`, `/robots.txt` | `apps/web/app` |
| The store's fallback name | `apps/web/lib/site.ts` (`SITE_NAME`) — a connected store's own name wins |
| Whether a store is connected, and the page that says how to connect one | `apps/web/lib/bigcommerce-connection.ts`, `apps/web/app/connect-store`, `apps/web/proxy.ts` |
| The GraphQL client (BigCommerce's Storefront API) and the queries | `packages/client`, `apps/web/client` |
| BigCommerce's Storefront schema the types are generated from | `apps/web/bigcommerce.graphql` |
| Sessions (Auth.js) and the key they are signed with | `apps/web/auth`, `apps/web/lib/auth-secret.ts`, `apps/web/worker.ts` |
| The route-lookup cache (KV) | `apps/web/lib/kv` |
| Workers build, cache bindings and deploy contract | `apps/web/next.config.ts`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ `wrangler.jsonc`), `component.yaml` |
| The R2 bucket and the KV namespace (stage, prod) | `infra/terraform/cloudflare-r2`, `infra/terraform/cloudflare-kv` |
| Tests | `apps/web` (the storefront's own vitest suite), `tests/web` |

Catalyst's own guides — its components (`apps/web/vibes`), theming,
OpenTelemetry, its Playwright suite (`apps/web/tests`) — are in
`apps/web/README.md`, `apps/web/AGENTS.md` and [catalyst.dev](https://www.catalyst.dev/docs).

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck          # generates the GraphQL types from apps/web/bigcommerce.graphql first
pnpm lint
pnpm test
pnpm build              # next build --webpack + opennextjs-cloudflare build → apps/web/.open-next
```

```bash
pnpm --filter @app/web preview   # wrangler dev over the built Worker: local R2, KV and Durable Objects
```

With no store the storefront says how to connect one. To run against your
store locally, put `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_STOREFRONT_TOKEN`
(and `BIGCOMMERCE_CHANNEL_ID`) in `apps/web/.dev.vars` and in the shell you
build from. `pnpm --filter @app/web dev` (Next's own server) needs Node 24:
the storefront's proxy uses `URLPattern`, which Node 22 lacks and workerd has.

## Connecting BigCommerce

1. In your BigCommerce control panel, note the **store hash** — the
   `store-<hash>` in its URL — and create a **storefront API token**
   (Settings → API → Storefront API tokens), or use the Catalyst CLI's
   `npm create catalyst` against a new channel and take the values it
   writes. A dedicated channel is recommended; channel 1 sells what the
   store's default Stencil storefront sells.
2. Set them as the product's Orun secrets, per environment:

   ```bash
   orun secrets set BIGCOMMERCE_STORE_HASH        --env stage   # prompts for the value
   orun secrets set BIGCOMMERCE_STOREFRONT_TOKEN  --env stage
   orun secrets set BIGCOMMERCE_CHANNEL_ID        --env stage   # optional, 1 by default
   orun secrets set BIGCOMMERCE_STORE_HASH        --env prod
   orun secrets set BIGCOMMERCE_STOREFRONT_TOKEN  --env prod
   orun secrets set BIGCOMMERCE_CHANNEL_ID        --env prod
   ```
3. Redeploy (below, "Deploy by hand"). The build reads the store's settings —
   its site, checkout and CDN URLs, its `robots.txt` and sitemap — and the
   deploy sets the three as Worker secrets, so every request reads the store.

Point the channel's site URL at the store's address (its workers.dev URL, or
your domain) in the control panel, so BigCommerce's checkout returns
shoppers to it.

**Sessions.** Customers sign in with Auth.js, its cookies signed with a key
the Worker generates for itself the first time one is needed and keeps in its
KV namespace — nothing to type. To use your own (and to rotate it, which signs
everyone out), set `AUTH_SECRET` as an Orun secret and redeploy.

## How the cache is wired

Every query the storefront sends BigCommerce carries a revalidation window
(`DEFAULT_REVALIDATE_TARGET`, an hour unless you set it) and tags; Next's data
cache keeps each answer in the R2 bucket (`NEXT_INC_CACHE_R2_BUCKET`), and an
answer past its window is served once more while a Durable Object queue
re-reads it in the background through the Worker itself
(`WORKER_SELF_REFERENCE`). The cart, checkout and customer data are never
cached across shoppers: those reads skip the cache, and the server actions
that change them revalidate their tags in the Durable Object tag cache. The
storefront's route lookups (which page a path is), its store status and its
locales are cached in the KV namespace (`CATALYST_ROUTES_KV`). The bucket and
the namespace are rendered into the Worker's config from the wiring documents
their applies publish; edit `apps/web/wrangler.template.jsonc`, then
`pnpm run wire:fixture`, and commit both.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The R2 bucket and the KV namespace
apply first, then the storefront builds for that environment — its bucket,
its namespace, its origin, and its BigCommerce store if one is set — and
deploys, to `stage`, then to `prod` once stage has converged on the same
commit; `dev` only verifies. The Worker is `catalyst-commerce-web-<env>` on
your account's workers.dev subdomain, and every deploy is smoke-tested over
HTTP: the home page must answer, and so must `/api/health`, which only the
Worker can. A pull request runs the same pipeline's verify lanes, with nothing
applied or deployed: the bucket and the namespace planned for stage and prod,
and the storefront built and dry-deployed for each environment. They do not
run the tests or the linter — run those before you push (Getting started,
above). (A push to `main` applies, builds and deploys.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The Cloudflare
tokens and account id are brokered per run from the workspace's Cloudflare
connection — one to deploy the Worker and apply the namespace, one with R2
access for the bucket's apply — and the bucket's name, the namespace's id and
your store's settings travel as Orun secrets; nothing provider-shaped is
stored in the repository or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after setting your
store's secrets, say. A component with nothing to run in that environment (a
test suite in `prod`) is left out with a notice.

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Next.js hosting (SSR, server actions, route handlers, the proxy) | One Cloudflare Worker (`worker.ts` over `.open-next/worker.js`) + Static Assets (`ASSETS`) |
| Data Cache entries | The R2 bucket bound as `NEXT_INC_CACHE_R2_BUCKET` |
| `revalidateTag` | A sharded Durable Object tag cache consulted on every cache read |
| Stale-while-revalidate | A Durable Object queue that re-reads stale entries through the Worker |
| Vercel Runtime Cache (route lookups) | Catalyst's own Cloudflare KV adapter, bound as `CATALYST_ROUTES_KV` |
| `AUTH_SECRET` typed into the project | Generated by the Worker and kept in its KV namespace; an Orun secret `AUTH_SECRET` wins |
| `AUTH_TRUST_HOST` (implicit on Vercel) | A Worker var |
| `BIGCOMMERCE_STORE_HASH`, `BIGCOMMERCE_STOREFRONT_TOKEN`, `BIGCOMMERCE_CHANNEL_ID` | Orun secrets (above), set as Worker secrets by every deploy; the "connect your BigCommerce store" page until set |
| GraphQL types generated from the live store at every build | Generated from the committed `bigcommerce.graphql` (BigCommerce's published Storefront schema); `pnpm --filter @app/web generate:schema` refreshes it from your store |
| `@vercel/otel` instrumentation | Loaded only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set |
| Vercel Web Analytics, Speed Insights | Off unless the build runs on Vercel, as upstream already does |
| Deploy on push | Orun applies the bucket and the namespace and deploys `catalyst-commerce-web-{stage,prod}` on merge to `main` (`apps/web/component.yaml`) |

## Custom domain

The store answers on workers.dev from its first deploy. To serve it on your
own domain:

1. Add the domain to the Cloudflare account the store deploys into, and attach
   it to the Worker (dashboard → Workers & Pages →
   `catalyst-commerce-web-prod` → Settings → Domains & Routes → Add →
   Custom domain).
2. Set the environment's public origin in `intent.yaml`, so the next deploy
   builds the store's `robots.txt` sitemap line for it (until then it uses
   the workers.dev URL):

   ```yaml
   environments:
     prod:
       env:
         SITE_URL: https://shop.example.com
   ```

   The store was born with the reserved placeholder
   `catalyst-commerce.example.com` where its domain goes: `BASE_DOMAIN` under
   each environment in `intent.yaml`. Replace it with your domain in the same
   change, and land it with a change under `apps/web` so the merge rebuilds
   the store. Point the BigCommerce channel's site URL at the new domain too.

## Licence

The storefront is BigCommerce's Catalyst, under the MIT licence
(`apps/web/LICENSE`).
