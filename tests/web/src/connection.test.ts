import { describe, expect, it } from "vitest";

import { bigcommerceConnected } from "~/lib/bigcommerce-connection";

import { A_STORE, STORE_VARS, withEnv } from "./env";

// lib/bigcommerce-connection.ts: a store is connected when both its hash and
// a storefront token are set — the two the storefront cannot read anything
// without. The channel is optional (1, the store's default).
describe("whether a BigCommerce store is connected", () => {
  it("is not, on a fresh product", async () => {
    await withEnv(STORE_VARS, {}, () => expect(bigcommerceConnected()).toBe(false));
  });

  it.each([
    [{ BIGCOMMERCE_STORE_HASH: "abc123" }],
    [{ BIGCOMMERCE_STOREFRONT_TOKEN: "test-token-not-a-store" }],
    [{ BIGCOMMERCE_STORE_HASH: "", BIGCOMMERCE_STOREFRONT_TOKEN: "test-token-not-a-store" }],
  ])("is not, with only some of it: %j", async (env) => {
    await withEnv(STORE_VARS, env, () => expect(bigcommerceConnected()).toBe(false));
  });

  it("is, with a hash and a storefront token", async () => {
    await withEnv(STORE_VARS, A_STORE, () => expect(bigcommerceConnected()).toBe(true));
  });
});
