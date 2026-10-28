# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`catalyst-commerce/`](./catalyst-commerce/) | **CA** | In progress (CA1: the site on Workers) | BigCommerce's Catalyst (Vercel's Catalyst by BigCommerce) on Cloudflare Workers, its BigCommerce reads cached in R2 and revalidated through Durable Objects, its route lookups in KV — and an Orun baseline that instantiates it in one landing, live before a store is connected (CA2) |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
