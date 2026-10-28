// The bindings the app reads through getCloudflareContext(). `wrangler types`
// would generate this from wrangler.jsonc; the bindings the code touches are
// kept by hand so the build needs no rendered config (and so the global
// Workers types never retype the app's Request/Response).
declare global {
  interface CloudflareEnv {
    ASSETS: {
      fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
    };
    CATALYST_ROUTES_KV?: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
    };
  }
}

export {};
