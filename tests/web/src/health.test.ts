import { describe, expect, it } from "vitest";

import { GET } from "~/app/api/health/route";

import { A_STORE, STORE_VARS, withEnv } from "./env";

// app/api/health: the deploy's smoke and the deployment record's probe. It
// answers from the Worker, calls nothing, and says whether a store is
// connected.
describe("/api/health", () => {
  it("answers before a store is connected", async () => {
    const body = await withEnv(STORE_VARS, {}, async () => (await GET()).json());
    expect(body).toEqual({ ok: true, bigcommerce: "not-connected" });
  });

  it("says so once a store is connected", async () => {
    const body = await withEnv(STORE_VARS, A_STORE, async () => (await GET()).json());
    expect(body).toEqual({ ok: true, bigcommerce: "connected" });
  });
});
