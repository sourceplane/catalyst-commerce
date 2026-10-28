# catalyst-commerce — design

## 1. The storefront

Catalyst is BigCommerce's Next.js storefront: home, categories, brands,
faceted search, product pages with options and variants, a cart, the store's
own checkout (BigCommerce's hosted checkout, reached from the cart), customer
accounts with orders, addresses and wish lists, a blog, web pages, gift
certificates, several languages (next-intl). Its data is the store's, read
over the Storefront GraphQL API by `@bigcommerce/catalyst-client`
(`packages/client`), the queries typed by gql.tada. Customers sign in through
Auth.js. Upstream lives in `core/` of a monorepo; here it is `apps/web`, and
the two workspace packages it needs, the client and its ESLint config, are
`packages/`.

## 2. Vercel → Cloudflare

OpenNext builds the storefront into one Worker with Static Assets, the
commerce baseline's shape. Catalyst already supports Cloudflare: it ships a
KV adapter for its route cache (`lib/kv/adapters/cloudflare-kv.ts`) and an
OpenNext template for BigCommerce's own hosting. The pieces Vercel provided:
the data cache (→ R2), `revalidateTag` (→ a Durable Object tag cache),
stale-while-revalidate (→ a Durable Object queue), the Runtime Cache for route
lookups (→ KV, Catalyst's adapter), `AUTH_TRUST_HOST` (→ a Worker var) and
the project's env vars (→ Orun secrets, set as Worker secrets by the deploy).

## 3. The cache

Every query carries `next: { revalidate, tags }` — the window
`DEFAULT_REVALIDATE_TARGET`, an hour by default — so the answers live in
Next's data cache, which OpenNext keeps in R2. Cart, checkout and customer
reads skip the cache; the server actions that change them revalidate their
tags. Catalyst does not use Cache Components, so nothing upstream is turned
off for the adapter (unlike saleor-commerce and your-next-store, whose Cache
Components hang on workerd).

## 4. The schema

Upstream generates `bigcommerce.graphql` from the live store at every build.
BigCommerce publishes the Storefront schema (bigcommerce/checkout-sdk-js,
`packages/core/schema/storefront.graphql`, MIT); committed as
`apps/web/bigcommerce.graphql`, every Catalyst query typechecks against it,
so the build, the type check, the lint and the tests need no store.
`generate:schema` refreshes it from a connected store.

## 5. Before a store, and after

A fresh product has no store. `lib/bigcommerce-connection.ts` is the one seam:
connected when the store hash and a storefront token are both set.
Unconnected, `next.config.ts` writes default settings instead of reading the
store's, the client defaults to channel 1, the sitemap, `robots.txt` and
favicon answer without the store, the proxy rewrites `/` to a static
`connect-store` page and redirects everything else to `/`, and the `[locale]`
layout redirects too (a path the proxy's matcher skips, `/api/<x>`, lands
there as a locale). Connected, upstream runs unchanged. The store's settings
are optional Orun secrets: the build reads the store's settings with them,
and the deploy sets them as Worker secrets (`tooling/wire/worker-secrets.mjs`),
because the Worker reads them on every request.

## 6. The session key

Auth.js needs `AUTH_SECRET`. There is no database to generate it in (the
Supabase starters keep theirs in Postgres), so `worker.ts` wraps OpenNext's
Worker and hands it one: the owner's `AUTH_SECRET` if set, otherwise a key the
environment generated the first time one was needed and keeps in its KV
namespace (`lib/auth-secret.ts`). KV is eventually consistent; the value read
back after the write is the one used, so isolates converge, and a session
signed in a fresh store's first moment may end once.

## 7. Tests

The storefront's own vitest suite (upstream's, 286 tests) runs as it is, with
a `URLPattern` polyfill where Node 22 lacks it. `tests/web` covers the seam,
the connection, the proxy before a store, the store-free routes, the health
route and the session key. The end-to-end tier serves the built Worker as
born and then connected to a stand-in BigCommerce — graphql-js over the
published schema with one default resolver — and proves the cache: no reads
on a second visit, a change held for the window and then re-read in the
background. A canary storefront token proves no build artifact carries it.

## 8. The rename

The rename engine is the commerce baseline's. The slug, its Pascal form and
its env prefix appear nowhere in upstream; the store's name is one seam,
`SITE_NAME` in `lib/site.ts`, the title before a store is connected and the
fallback when a store has none. `Catalyst` and `BigCommerce` are the
storefront's own words and are never renamed.

## 9. Alternatives rejected

- **A bundled demo catalogue** (the commerce baseline's demo mode): Catalyst
  has dozens of deep typed queries; faking them in the Worker would be a
  second storefront. The connect page is the template's unconfigured state
  made explicit.
- **Upstream's self-fetch revalidation queue** (its BigCommerce-hosting
  template): it exists because a dispatch-namespace script cannot have a
  self-reference binding; a plain Worker can, so OpenNext's Durable Object
  queue (with its retries) is used, as commerce does.
- **The session key in Terraform state** (`random_password`): it would sit in
  the state file; generated at run time it never leaves Cloudflare.
- **Turbopack**: its middleware bundle misses `@opentelemetry/api`'s ESM
  build on OpenNext; webpack bundles.
- **Trimming the Worker to Workers Free** (3.4 MiB → under 3): it would mean
  dropping Catalyst's features; Workers Paid is stated instead.
