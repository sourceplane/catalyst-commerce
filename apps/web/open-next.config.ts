// OpenNext Cloudflare adapter config.
//
// The storefront caches its BigCommerce reads in Next's data cache — each
// query's `fetchOptions: { next: { revalidate, tags } }`, the window
// DEFAULT_REVALIDATE_TARGET (an hour by default, client/revalidate-target.ts)
// — and its server actions revalidate the cart, checkout and customer tags
// with `revalidateTag`. That is Next's data cache plus its tag cache, which
// on Workers live in bindings:
//
//   incremental cache → R2 (NEXT_INC_CACHE_R2_BUCKET): every pre-rendered
//                       route and every cached BigCommerce response
//   tag cache         → a sharded Durable Object (NEXT_TAG_CACHE_DO_SHARDED):
//                       which tags were revalidated when, consulted on every
//                       cache read so a stale entry is re-read
//   queue             → a Durable Object (NEXT_CACHE_DO_QUEUE): deduplicated
//                       background revalidation of an entry past its window,
//                       which calls the Worker back through
//                       WORKER_SELF_REFERENCE
//
// The bucket is provisioned by infra/terraform/cloudflare-r2 and wired into
// wrangler.jsonc per environment; the Durable Objects are classes the
// generated Worker exports (DOQueueHandler, DOShardedTagCache) and the
// `migrations` in wrangler.template.jsonc create on deploy. The storefront's
// own route-lookup cache is the KV namespace (lib/kv), not this file's.
import { defineCloudflareConfig } from '@opennextjs/cloudflare/config';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue';
import doShardedTagCache from '@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache';

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: doShardedTagCache({ baseShardSize: 12 }),
});
