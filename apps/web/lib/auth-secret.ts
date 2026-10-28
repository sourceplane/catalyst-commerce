// The key Auth.js signs sessions with.
//
// Upstream reads AUTH_SECRET, which its owner generates and sets. A deployed
// Worker has no setup step to do that, so the key is the first of these:
//
//   1. AUTH_SECRET — a Worker secret the owner set (the product's Orun
//      secret, pushed by the deploy). Setting it is how an owner rotates the
//      key: every session signed under the previous one ends.
//   2. the key this environment generated for itself: 32 random bytes, kept
//      in the environment's KV namespace (CATALYST_ROUTES_KV) under
//      AUTH_SECRET_KEY the first time a request needs one, so it is never in
//      a repository, a CI log or a deploy artifact, and stage and prod each
//      have their own.
//
// KV is eventually consistent: two first requests in different places could
// each write a key. The value read back after the write is used, so every
// isolate converges on the one that landed; a session signed in that first
// moment under the other ends once.
export const AUTH_SECRET_KEY = 'auth:secret';

export interface SecretStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

let generated: string | undefined;

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function authSecret(
  configured: string | undefined,
  store: SecretStore | undefined,
): Promise<string | undefined> {
  if (configured) return configured;
  if (generated) return generated;
  if (!store) return undefined;

  const stored = await store.get(AUTH_SECRET_KEY);

  if (stored) {
    generated = stored;

    return stored;
  }

  await store.put(AUTH_SECRET_KEY, randomKey());

  const landed = await store.get(AUTH_SECRET_KEY);

  generated = landed ?? undefined;

  return generated;
}

// For the tests: forget the isolate's copy.
export function resetAuthSecretCache(): void {
  generated = undefined;
}
