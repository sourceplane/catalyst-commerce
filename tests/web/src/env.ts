// Run a test with exactly these variables set (the rest of `names` unset),
// restoring the process's own afterwards.
export async function withEnv<T>(
  names: readonly string[],
  env: Partial<Record<string, string>>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const saved = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  for (const k of names) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of names) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

export const STORE_VARS = ["BIGCOMMERCE_STORE_HASH", "BIGCOMMERCE_STOREFRONT_TOKEN", "BIGCOMMERCE_CHANNEL_ID"] as const;

// A connected store, for tests: values that are no real store's.
export const A_STORE = { BIGCOMMERCE_STORE_HASH: "abc123", BIGCOMMERCE_STOREFRONT_TOKEN: "test-token-not-a-store" };
