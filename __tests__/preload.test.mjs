import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const html = readFileSync(join(__dirname, "../src/index.html"), "utf-8");
const norm = (s) => s.replace(/\s+/g, " ").trim();
const preload = manifest.preload ?? {};

// The hub runs `manifest.preload` while rendering the document and answers the
// app's matching api/db request from the embedded rows — matching on the
// statement text with whitespace collapsed. A drifted copy is not an error
// anywhere: it is a preload that silently never answers. So the manifest is
// checked against the source here.
describe("manifest.preload mirrors the app's first-render reads", () => {
  const prefix = `app_${manifest.id.replace(/-/g, "_")}__`;
  // src/index.html names every table as `${T.name}` inside a template literal,
  // so the posted text never appears in the file verbatim. Expand each T entry
  // to the table it maps to — and pin the map, or the expansion proves nothing.
  const T = Object.fromEntries(
    [...(/const T = \{([\s\S]*?)\};/.exec(html)?.[1] ?? "").matchAll(/(\w+):\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]),
  );
  let expanded = html;
  for (const [key, table] of Object.entries(T)) expanded = expanded.replaceAll(`\${T.${key}}`, table);
  const body = norm(expanded);

  it("expands ${T.*} to this app's tables", () => {
    expect(T).toEqual({
      exchanges: `${prefix}exchanges`,
      participants: `${prefix}participants`,
      assignments: `${prefix}assignments`,
      giftNotes: `${prefix}gift_notes`,
      exclusions: `${prefix}exclusions`,
    });
  });

  it("declares statements the app posts, byte-for-byte after whitespace collapse", () => {
    // The whole db(`…`) argument with no params, not a substring of it.
    for (const [name, { sql, params = [] }] of Object.entries(preload)) {
      expect(params, name).toEqual([]);
      expect(body.includes(`db(\`${norm(sql)}\`)`), `preload.${name} is not the text src/index.html posts`).toBe(true);
    }
  });

  it("preloads every read loadData fires together — a miss would invalidate the rest", () => {
    const batch = /const \[x, p, a, n, e\] = await Promise\.all\(\[([\s\S]*?)\]\);/.exec(expanded)?.[1] ?? "";
    const posted = [...norm(batch).matchAll(/db\(`([^`]*)`\)/g)].map((m) => m[1]);
    expect(posted).toEqual(Object.values(preload).map(({ sql }) => norm(sql)));
  });

  it("stays within the hub's caps and reads only this app's tables", () => {
    expect(Object.keys(preload).length).toBeLessThanOrEqual(6);
    for (const [name, { sql, params = [] }] of Object.entries(preload)) {
      expect(sql, name).toMatch(/^(SELECT|WITH) /);
      expect(sql, name).not.toMatch(/;|--/);
      for (const table of sql.match(/(?:FROM|JOIN)\s+(\w+)/g) ?? []) expect(table, name).toMatch(new RegExp(`\\s${prefix}`));
      expect((sql.match(/\?/g) ?? []).length, `${name}: placeholders vs params`).toBe(params.length);
    }
  });
});
