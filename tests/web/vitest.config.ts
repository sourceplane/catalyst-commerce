import { defineConfig } from "vitest/config";
import * as path from "node:path";

// The storefront imports its own modules as `~/…` and `@/vibes/…`
// (apps/web/tsconfig.json `paths`); the aliases make the same specifiers
// resolve from here, and `server-only` (which throws outside React's server
// environment) is a no-op.
const app = path.resolve(__dirname, "../../apps/web");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\//, replacement: `${app}/` },
      { find: /^@\/vibes\//, replacement: `${app}/vibes/` },
      { find: /^server-only$/, replacement: path.resolve(__dirname, "server-only.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // next-auth and next-intl import `next/…` without an extension, which Node's own
    // ESM resolution refuses; transformed by Vite, it resolves as in Next.
    server: { deps: { inline: [/next-auth/, /next-intl/, /@auth\/core/] } },
  },
});
