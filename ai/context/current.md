# catalyst-commerce — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a storefront built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

BigCommerce's Catalyst (bigcommerce/catalyst — Vercel's Catalyst by
BigCommerce) on Cloudflare Workers + Static Assets through
`@opennextjs/cloudflare`, its Next.js cache in an R2 bucket and two Durable
Objects the Worker exports, its route lookups in a KV namespace, packaged as
an Orun baseline: `orun new --blueprint repo-blueprint.yaml` builds a new
storefront in its own repository and takes it to live on stage and prod in
one landing (`01-product`) — the bucket and the namespace applied before the
Worker that binds them — then records what went live (`02-docs`). With no
BigCommerce store connected it says "Connect your BigCommerce store" and sends
every page there; the owner connects one by setting its store hash and a
storefront token as Orun secrets and redeploying. It needs Workers Paid (about
3.4 MiB gzipped).

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (CA2) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI — the storefront built and served as born, then connected to a stand-in BigCommerce, its cache reused and revalidated after its window |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/catalyst-commerce/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/catalyst-commerce/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/catalyst-commerce/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/web/docs/`, `infra/terraform/cloudflare-r2/docs/`, `infra/terraform/cloudflare-kv/docs/`, `tests/web/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one storefront from `baseline-v1` on a Workers Paid account and
   record its timings; connect a BigCommerce sandbox store to it once, sign a
   customer in and place a test order. That closes CA-A and CA-B.
2. Follow Catalyst's releases (`@bigcommerce/catalyst-core`) into `apps/web`
   and `packages/`, re-running the e2e.
