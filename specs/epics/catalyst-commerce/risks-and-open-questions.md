# catalyst-commerce — risks and open questions

| ID | Risk | State | Notes |
|---|---|---|---|
| CA-A | `baseline-v1` is not yet proven live | OPEN | Proven offline in Baseline CI: the offline bootstrap with the blueprint's own hooks, the stage lane's steps in a staged tree, the product served as born and connected to a stand-in. A real store's checkout and sign-in, the real applies and the Worker secrets on a real account are unproven. |
| CA-B | Workers Paid | OPEN | The Worker is 3.4 MiB gzipped (16.8 MiB raw); Free allows 3 MiB. Stated on the card. |
| CA-C | Next's Node.js middleware (`proxy.ts`) on OpenNext | ACCEPTED | `opennextjs-cloudflare build` calls it experimental; the e2e drives the proxy on every request, unconnected and connected. |
| CA-D | Next 16.3.8, webpack | ACCEPTED | Inside upstream's `~16.3.4`; @opennextjs/cloudflare 1.20.11 needs `>=16.3.8`. Turbopack's middleware bundle cannot resolve `@opentelemetry/api`. |
| CA-E | The schema is vendored | ACCEPTED | BigCommerce's published Storefront schema (2026-08-31). A store on a newer API may have fields the committed schema lacks; `generate:schema` refreshes it. |
| CA-F | The session key in KV | ACCEPTED | Generated on first use; KV is eventually consistent, so two first requests in different places may each write one and a session signed in that moment ends once. `AUTH_SECRET` (an Orun secret) replaces it. |
| CA-G | The stand-in is not a catalogue | ACCEPTED | It answers every query from the schema, deterministically; no checkout, sign-in or cart mutation is completed against it. |
| CA-H | `pnpm dev` needs Node 24 | ACCEPTED | The proxy uses `URLPattern`, a global in Node 24 and in workerd, not in Node 22 (the lanes' Node); the tests polyfill it. |
| CA-I | A removed store secret stays on the Worker | ACCEPTED | The deploy sets the secrets that exist and deletes none; `wrangler secret delete` removes one (operations.md). |
