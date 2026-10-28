import { describe, expect, it } from "vitest";

import { STORE_VARS, withEnv } from "./env";

// The routes Next.js pre-renders at build read the store's settings; before
// a store is connected each answers without it, so a fresh product builds
// and its crawlers' files are valid.
describe("the pre-rendered routes before a store is connected", () => {
  it("sitemap.xml is an empty sitemap index", async () => {
    await withEnv(STORE_VARS, {}, async () => {
      const { GET } = await import("~/app/sitemap.xml/route");
      const res = await GET();
      expect(res.headers.get("content-type")).toBe("application/xml");
      expect(await res.text()).toMatch(/^<\?xml[^>]*\?><sitemapindex [^>]*><\/sitemapindex>$/);
    });
  });

  it("robots.txt allows crawling", async () => {
    await withEnv(STORE_VARS, {}, async () => {
      const { GET } = await import("~/app/robots.txt/route");
      expect(await (await GET()).text()).toBe("User-agent: *\nAllow: /\n");
    });
  });

  it("favicon.ico is absent (the store's own favicon, once connected)", async () => {
    await withEnv(STORE_VARS, {}, async () => {
      const { GET } = await import("~/app/favicon.ico/route");
      expect((await GET()).status).toBe(404);
    });
  });
});
