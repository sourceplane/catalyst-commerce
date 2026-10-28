#!/usr/bin/env python3
"""What a visitor does to the served Worker — testing/e2e.test.sh's stages 3 and 4.

    e2e-visit.py born      <url> <values.json>
    e2e-visit.py connected <url> <values.json>    (E2E_API, E2E_REVALIDATE_SECONDS)

`born` is a fresh product, no BigCommerce store: `/` asks for one under the
product's name; every storefront path, `/cart`, `/checkout`, `/login` and a
path the proxy never sees (`/api/<x>`, which the storefront's routing takes
for a locale) go there; `/api/health` says not connected; the crawlers'
files answer without a store; Auth.js answers with the key the Worker
generated for itself in its KV namespace (a CSRF token signed, a session
read); and nothing ever answers 500.

`connected` is the same product built with the stand-in BigCommerce
(testing/lib/fake-bigcommerce.mjs) as its store and the store's settings as
Worker secrets: the home page, a product, a category, search, the cart and
the sign-in page render; a second visit reads BigCommerce not at all (every
read is in Next's data cache, in the local R2 bucket, and every route lookup
in the KV namespace); a change in the store stays cached inside the
revalidation window (DEFAULT_REVALIDATE_TARGET, short here), and after it the
stale page is served while the Durable Object queue re-reads in the
background, and a later visit shows the change.
"""
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

mode, base, values = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
name = values["productname"]
# Upstream's fallback store name: residue in a product named anything else.
UPSTREAM_NAME = "Catalyst Store"
renamed = name != UPSTREAM_NAME
problems = []


def bad(m):
    problems.append(m)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def request(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=dict(headers or {}), method=method)
    try:
        r = opener.open(req, timeout=90)
    except urllib.error.HTTPError as e:
        r = e
    return r.status, r.headers, r.read()


def get(path):
    s, h, b = request(base + path)
    if s >= 500:
        bad(f"{path} answered {s}")
    return s, h, b.decode("utf-8", "replace")


def title_of(page):
    m = re.search(r"<title>(.*?)</title>", page, re.S)
    return html.unescape(m.group(1)).strip() if m else None


def done(summary):
    if problems:
        print(f"FAIL: {mode}:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(1)
    print(f"   {summary}")


if mode == "born":
    s, _, page = get("/")
    if s != 200 or "Connect your BigCommerce store" not in html.unescape(page):
        bad(f"/ is not the connect page ({s})")
    if title_of(page) != name:
        bad(f"/ is titled {title_of(page)!r}, not the product's name {name!r}")
    if renamed and UPSTREAM_NAME in html.unescape(page):
        bad(f"/ still says {UPSTREAM_NAME!r}")
    for path in ("/en/", "/sample-product-1/", "/sample-category-1/", "/search/?term=tee",
                 "/cart/", "/checkout/", "/login/", "/api/not-a-route"):
        s, h, _ = get(path)
        where = h.get("location", "")
        if s not in (307, 308) or where not in ("/", base + "/"):
            bad(f"{path} answered {s} → {where!r}, not a redirect to /")
    s, _, body = get("/api/health")
    if s != 200 or json.loads(body or "{}") != {"ok": True, "bigcommerce": "not-connected"}:
        bad(f"/api/health answered {s}: {body[:120]!r}")
    s, _, body = get("/sitemap.xml")
    if s != 200 or "<sitemapindex" not in body:
        bad(f"/sitemap.xml answered {s}: {body[:120]!r}")
    s, _, body = get("/robots.txt")
    if s != 200 or "User-agent: *" not in body:
        bad(f"/robots.txt answered {s}: {body[:120]!r}")
    # Auth.js signs with the key the Worker generated (no AUTH_SECRET set).
    s, _, body = get("/api/auth/csrf")
    if s != 200 or not re.fullmatch(r'\{"csrfToken":"[0-9a-f]{64}"\}', body.strip()):
        bad(f"/api/auth/csrf answered {s}: {body[:120]!r} — Auth.js has no signing key")
    s, _, _ = get("/api/auth/session")
    if s != 200:
        bad(f"/api/auth/session answered {s}")
    done("a fresh deploy asks for a store under the product's name; every page goes there; "
         "health, the crawlers' files and Auth.js (its key generated in KV) answer; never a 500")
    sys.exit(0)

# ── connected ──────────────────────────────────────────────────────────────
API = os.environ["E2E_API"]
WINDOW = int(os.environ.get("E2E_REVALIDATE_SECONDS", "5"))


def api_call(path, method="GET"):
    with urllib.request.urlopen(urllib.request.Request(API + path, method=method), timeout=30) as r:
        return r.read().decode()


def reads():
    return sum(json.loads(api_call("/__calls")).values())


def reset():
    api_call("/__reset", "POST")


PAGES = ["/", "/sample-product-1/", "/sample-category-1/", "/search/?term=sample", "/cart/", "/login/"]

reset()
first = {}
for path in PAGES:
    s, _, page = get(path)
    first[path] = page
    if s != 200:
        bad(f"{path} answered {s} with a store connected")
if reads() == 0:
    bad("the first visits read nothing from BigCommerce — the store is not connected")
if "Sample product 1 v1" not in html.unescape(first["/sample-product-1/"]):
    bad("the product page does not show the product BigCommerce named")
if "Connect your BigCommerce store" in html.unescape(first["/"]):
    bad("/ still asks for a store with one connected")
s, _, body = get("/api/health")
if json.loads(body or "{}") != {"ok": True, "bigcommerce": "connected"}:
    bad(f"/api/health answered {s}: {body[:120]!r}")

# A second visit: everything from the cache.
reset()
for path in PAGES[:4]:
    get(path)
again = reads()
if again != 0:
    bad(f"a second visit read BigCommerce {again} time(s): {api_call('/__calls')}")

# A change in the store stays cached inside the window …
api_call("/__bump", "POST")
reset()
_, _, page = get("/sample-product-1/")
if "Sample product 1 v1" not in html.unescape(page) or reads() != 0:
    bad("inside the revalidation window the product page was re-read or changed")
# … and after it: served stale, re-read in the background, then new.
time.sleep(WINDOW + 2)
seen = False
for _ in range(20):
    _, _, page = get("/sample-product-1/")
    if "Sample product 1 v2" in html.unescape(page):
        seen = True
        break
    time.sleep(1)
if not seen:
    bad("after the revalidation window the product page never showed the store's change")
elif reads() == 0:
    bad("the change showed without BigCommerce being read again")

done("the catalogue renders from the store; a second visit reads BigCommerce not at all; "
     "a change shows only after the revalidation window, re-read in the background")
