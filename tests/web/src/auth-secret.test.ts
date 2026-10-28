import { beforeEach, describe, expect, it } from "vitest";

import { AUTH_SECRET_KEY, authSecret, resetAuthSecretCache, type SecretStore } from "~/lib/auth-secret";

// lib/auth-secret.ts: Auth.js's signing key is the owner's AUTH_SECRET, or
// the key the environment generated for itself and keeps in its KV
// namespace — never typed, never in the repository.
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const writes: string[] = [];
  const store: SecretStore = {
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      writes.push(key);
      data.set(key, value);
    },
  };
  return { store, data, writes };
}

beforeEach(() => resetAuthSecretCache());

describe("the auth secret", () => {
  it("is the owner's AUTH_SECRET when set, and nothing is generated", async () => {
    const { store, writes } = memoryStore();
    expect(await authSecret("owners-own-secret", store)).toBe("owners-own-secret");
    expect(writes).toEqual([]);
  });

  it("is generated once and kept in the namespace", async () => {
    const { store, data, writes } = memoryStore();
    const first = await authSecret(undefined, store);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(data.get(AUTH_SECRET_KEY)).toBe(first);
    resetAuthSecretCache();
    expect(await authSecret(undefined, store)).toBe(first);
    expect(writes).toEqual([AUTH_SECRET_KEY]);
  });

  it("is the one already in the namespace (another isolate's)", async () => {
    const { store, writes } = memoryStore({ [AUTH_SECRET_KEY]: "a".repeat(64) });
    expect(await authSecret(undefined, store)).toBe("a".repeat(64));
    expect(writes).toEqual([]);
  });

  it("is the value that landed when two first requests race", async () => {
    // The write lands, but another isolate's write lands after it: the
    // value read back is the one every isolate converges on.
    const { store, data } = memoryStore();
    const racing: SecretStore = {
      get: store.get,
      async put(key, value) {
        await store.put(key, value);
        data.set(key, "b".repeat(64));
      },
    };
    expect(await authSecret(undefined, racing)).toBe("b".repeat(64));
  });

  it("is absent with no namespace and no AUTH_SECRET (Auth.js then refuses to sign)", async () => {
    expect(await authSecret(undefined, undefined)).toBeUndefined();
  });
});
