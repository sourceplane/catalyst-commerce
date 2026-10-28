import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it } from "vitest";

import { STORE_VARS, withEnv } from "./env";

// apps/web/proxy.ts: before a store is connected `/` is the page that says
// how to connect one, every other storefront page goes to `/`, and nothing
// the storefront's own proxies do (routes, channels, sessions — each a
// BigCommerce read) runs. Connected, upstream's chain is untouched (the e2e
// drives it against a stand-in store).
const ORIGIN = "https://acme-shop-web-stage.acme.workers.dev";
const event = {} as NextFetchEvent;

function visit(path: string) {
  return new NextRequest(new URL(path, ORIGIN));
}

async function unconnectedProxy() {
  return (await import("~/proxy")).proxy;
}

describe("the storefront before a store is connected", () => {
  it("serves `/` as the connect page", async () => {
    await withEnv(STORE_VARS, {}, async () => {
      const res = await (await unconnectedProxy())(visit("/"), event);
      expect(res?.status).toBe(200);
      expect(res?.headers.get("location")).toBeNull();
      expect(res?.headers.get("x-middleware-rewrite")).toBe(`${ORIGIN}/connect-store`);
    });
  });

  it.each(["/en/", "/sample-product/", "/cart/", "/login/", "/checkout/", "/search/?term=tee", "/connect-store/"])(
    "sends %s to `/`",
    async (path) => {
      await withEnv(STORE_VARS, {}, async () => {
        const res = await (await unconnectedProxy())(visit(path), event);
        expect(res?.status).toBe(307);
        expect(res?.headers.get("location")).toBe(`${ORIGIN}/`);
      });
    },
  );
});
