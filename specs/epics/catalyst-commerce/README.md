# catalyst-commerce — BigCommerce's Catalyst storefront on Cloudflare Workers

BigCommerce's Catalyst, the storefront Vercel lists as "Catalyst by
BigCommerce", as one Cloudflare Worker with Static Assets — its BigCommerce
reads in Next's data cache in R2, the tag cache and the revalidation queue in
Durable Objects, its route lookups in KV — live before a store is connected,
and an Orun baseline that takes a new storefront from nothing to live on stage
and prod in one landing.

| | |
|---|---|
| Status | ✅ Shipped (`baseline-v1`) — proven offline in Baseline CI; not yet live (risk CA-A) |
| Upstream | [bigcommerce/catalyst](https://github.com/bigcommerce/catalyst) (`@bigcommerce/catalyst-core` 1.13.1, MIT), at `6faa4b5` (2026-10-27) |
| Reference | [commerce](https://github.com/sourceplane/commerce) — the same OpenNext, R2 and Durable Object shape for a storefront on a hosted commerce API; [kv-redis-starter](https://github.com/sourceplane/kv-redis-starter) for the KV root |
| Key | `CA` |

## Read in this order

1. [design.md](design.md) — the storefront, how each Vercel piece maps to
   Cloudflare, the cache, the schema, the store before and after it is
   connected, the session key, the tests, and the alternatives rejected.
2. [implementation-plan.md](implementation-plan.md) — the three landings.
3. [risks-and-open-questions.md](risks-and-open-questions.md).
4. [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — what shipped, every
   departure from upstream, and what was verified.

## Milestones

| Milestone | What it lands | Task |
|---|---|---|
| CA0 — the spec | this doc set and the three task contracts | CA-1 |
| CA1 — the storefront on Workers | `apps/web`, `packages/`, the R2 and KV roots, `tests/web` | CA-2 |
| CA2 — a baseline | the card, the build document, the rename, the tiers | CA-3 |
