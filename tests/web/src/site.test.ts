import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { SITE_NAME } from "~/lib/site";

// The rename engine rewrites the literal `SITE_NAME = "<name>"`
// (tooling/rebrand): the seam must stay one line of that exact shape, and the
// name the storefront uses must be the one that line spells.
describe("the storefront's name seam", () => {
  it("is one literal line in lib/site.ts, and is the name the storefront uses", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../apps/web/lib/site.ts"), "utf8");
    const lines = source.match(/^export const SITE_NAME = ("[^"\n]+");$/gm) ?? [];
    expect(lines).toHaveLength(1);
    expect(SITE_NAME).toBe(JSON.parse((lines[0] ?? "").replace(/^export const SITE_NAME = (.*);$/, "$1")));
    expect(SITE_NAME.length).toBeGreaterThan(0);
  });
});
