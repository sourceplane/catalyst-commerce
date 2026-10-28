# catalyst-commerce — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/catalyst-commerce/risks-and-open-questions.md`; this page lists only what
is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| CA-A | No live bootstrap yet: the repository created and linked, the tokens minted, real `terraform apply`s of the bucket and the namespace, a real `wrangler deploy` with the R2, KV and Durable Object bindings and the Worker secrets, the probes, and a real store's checkout and sign-in | OPEN | One bootstrap on a Paid account, connected to a BigCommerce sandbox |
| CA-B | Workers Paid: the Worker is 3.4 MiB gzipped; a Free account refuses the deploy | OPEN (stated on the card) | A live deploy on a Paid account |
| CA-C | Next's Node.js middleware (`proxy.ts`) on OpenNext is experimental | ACCEPTED | — (the e2e drives the proxy on every request) |

Accepted, and worth knowing before you change them: CA-D (Next 16.3.8 and
webpack), CA-E (the schema vendored, not read from the store), CA-F (the
session key generated in KV — two first requests in different places may
each write one, and a session signed in that moment ends once), CA-G (the
stand-in is not a catalogue; no checkout or sign-in completed offline),
CA-H (`pnpm dev` needs Node 24 for `URLPattern`; the lanes and the Worker
do not).
