# catalyst-commerce — implementation plan

Three landings, one per milestone, each a pull request merged on green.

1. **CA0 — the spec (CA-1).** This doc set and the three task contracts.
2. **CA1 — the storefront on Workers (CA-2).** Upstream's `core/` into
   `apps/web` and its `client` and `eslint-config-catalyst` into `packages/`,
   the lockfile seeded from upstream's; OpenNext with the R2 incremental
   cache and the Durable Object tag cache and queue; the KV root
   (kv-redis-starter's) for Catalyst's route cache; the vendored Storefront
   schema; the connection seam and the connect page; the Worker entry and the
   generated session key; the store's settings as optional secrets and Worker
   secrets; `tests/web`. Done when typecheck, lint, test and build are green
   with no store, and `wrangler dev` serves it unconnected and connected.
3. **CA2 — a baseline (CA-3).** The card and the build document, the rename
   (identity and seam), the deployment record, the phase pages, the context
   pack, and every tier of Baseline CI, including the end-to-end tier with a
   stand-in BigCommerce.
