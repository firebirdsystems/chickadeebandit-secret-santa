import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

const VALID_STORAGE   = ["kv", "db", "none"];
const VALID_AUDIENCES = ["everyone", "adults", "children"];

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });

  it("entrypoint is index.html", () => expect(manifest.entrypoint).toBe("index.html"));
  it("runtime is static",        () => expect(manifest.runtime).toBe("static"));

  it("storage is declared and valid", () => {
    expect(manifest.storage, "storage field is required").toBeTruthy();
    expect(VALID_STORAGE).toContain(manifest.storage);
  });

  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));

  it("permissions.default_audience is valid", () => {
    expect(VALID_AUDIENCES).toContain(manifest.permissions.default_audience);
  });

  it("permissions.requires_approval is boolean", () => {
    expect(typeof manifest.permissions.requires_approval).toBe("boolean");
  });

  it("data_access has reads and writes arrays", () => {
    expect(Array.isArray(manifest.data_access.reads)).toBe(true);
    expect(Array.isArray(manifest.data_access.writes)).toBe(true);
  });
});

// ── Calendar automation suggestions ───────────────────────────────────────────
// The hub only offers a suggestion whose trigger has an installed publisher, and
// a suggestion that misses a required param of its target action fails the run.

describe("suggested_automations", () => {
  const suggestions = manifest.suggested_automations ?? [];

  it("ships the exchange-date pair", () => {
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("every trigger_event is declared in publishes", () => {
    for (const s of suggestions) {
      expect(manifest.publishes, `undeclared trigger: ${s.trigger_event}`).toContain(s.trigger_event);
    }
  });

  it("every declared publish has a matching publish_acl", () => {
    for (const name of manifest.publishes ?? []) {
      expect(manifest.publish_acls?.[name]?.require_role, `${name} must be adult-gated`).toBe("adult");
    }
  });

  it("every calendar create_event maps event_date and source_ref_id", () => {
    const creates = suggestions.filter(s => s.target_app_id === "calendar" && s.action_id === "create_event");
    expect(creates.length).toBe(1);
    for (const s of creates) {
      // create_event requires title and event_date; source_ref_id is what makes
      // a moved date move the entry instead of adding a second one beside it.
      expect(s.param_map.title?.value).toBe("title");
      expect(s.param_map.event_date?.value).toBe("exchange_date");
      expect(s.param_map.source_ref_id?.value).toBe("source_ref_id");
    }
  });

  it("the retraction uses retract_dated_event and the same source_ref_id", () => {
    const retracts = suggestions.filter(s => s.action_id === "retract_dated_event");
    expect(retracts.length).toBe(1);
    expect(retracts[0].target_app_id).toBe("calendar");
    expect(retracts[0].trigger_event).toBe("secret_santa.exchange_cancelled");
    expect(retracts[0].param_map.source_ref_id?.value).toBe("source_ref_id");
    // A mismatched ref silently retracts nothing, so both halves must read the
    // same payload field — and index.html publishes the same value into both.
    const create = suggestions.find(s => s.action_id === "create_event");
    expect(retracts[0].param_map.source_ref_id.value).toBe(create.param_map.source_ref_id.value);
  });

  it("no suggestion carries anything about the draw or the free-text details", () => {
    // Assignments are sealed_until and gift_notes are owner_only; an automation
    // payload is readable by every member, so a pairing must never be mapped.
    const mapped = suggestions.flatMap(s => Object.values(s.param_map ?? {}).map(v => v.value));
    for (const forbidden of ["details", "giver_id", "receiver_id", "body", "hint"]) {
      expect(mapped, `${forbidden} must not reach an automation`).not.toContain(forbidden);
    }
  });
});

// ── ai_access SQL file validation ─────────────────────────────────────────────
// Auto-discovers all db_exports/db_mutations/db_inserts/db_deletes entries and
// validates each SQL file for type, household_id filter, and single-statement.

if (manifest.ai_access) {
  const ai = manifest.ai_access;

  const SQL_TYPES = [
    { field: "db_exports",   dir: "queries",   keyword: /^(SELECT|WITH)\b/i, label: "SELECT or WITH" },
    { field: "db_mutations", dir: "mutations",  keyword: /^UPDATE\b/i,        label: "UPDATE"         },
    { field: "db_inserts",   dir: "inserts",    keyword: /^INSERT\b/i,        label: "INSERT"         },
    { field: "db_deletes",   dir: "deletes",    keyword: /^DELETE\b/i,        label: "DELETE"         },
  ];

  for (const { field, dir, keyword, label } of SQL_TYPES) {
    const names = ai[field] ?? [];
    if (names.length === 0) continue;

    describe(`ai_access.${field}`, () => {
      it(`each name has a src/${dir}/{name}.sql file`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          expect(existsSync(path), `missing: src/${dir}/${name}.sql`).toBe(true);
        }
      });

      it(`each SQL file starts with ${label}`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8").trim();
          expect(
            keyword.test(sql),
            `src/${dir}/${name}.sql must start with ${label}, got: ${sql.slice(0, 50)}`
          ).toBe(true);
        }
      });

      it(`each SQL file is a single statement (no semicolons)`, () => {
        for (const name of names) {
          const path = join(__dirname, `../src/${dir}/${name}.sql`);
          if (!existsSync(path)) continue;
          const sql = readFileSync(path, "utf-8");
          expect(
            sql.includes(";"),
            `src/${dir}/${name}.sql must not contain semicolons`
          ).toBe(false);
        }
      });
    });
  }

  if (ai.db_inserts?.length) {
    describe("ai_access.db_inserts schemas", () => {
      it("each insert has a src/schemas/{name}.json file", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          expect(existsSync(path), `missing: src/schemas/${name}.json`).toBe(true);
        }
      });

      it("each schema file is valid JSON", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          expect(
            () => JSON.parse(readFileSync(path, "utf-8")),
            `src/schemas/${name}.json must be valid JSON`
          ).not.toThrow();
        }
      });

      it("each schema declares type:array with an items definition", () => {
        for (const name of ai.db_inserts) {
          const path = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(path)) continue;
          let schema;
          try { schema = JSON.parse(readFileSync(path, "utf-8")); } catch { continue; }
          expect(schema.type, `src/schemas/${name}.json must declare "type": "array"`).toBe("array");
          expect(
            Array.isArray(schema.items) || (typeof schema.items === "object" && schema.items !== null),
            `src/schemas/${name}.json must declare "items" to validate params`
          ).toBe(true);
        }
      });

      it("schema maxItems matches the number of $N placeholders in the SQL", () => {
        for (const name of ai.db_inserts) {
          const sqlPath    = join(__dirname, `../src/inserts/${name}.sql`);
          const schemaPath = join(__dirname, `../src/schemas/${name}.json`);
          if (!existsSync(sqlPath) || !existsSync(schemaPath)) continue;
          const sql = readFileSync(sqlPath, "utf-8");
          let schema;
          try { schema = JSON.parse(readFileSync(schemaPath, "utf-8")); } catch { continue; }
          const paramNums = [...sql.matchAll(/\$(\d+)/g)].map(m => parseInt(m[1], 10));
          const maxParam  = paramNums.length > 0 ? Math.max(...paramNums) : 0;
          expect(
            schema.maxItems,
            `src/schemas/${name}.json maxItems (${schema.maxItems}) must equal SQL $N count (${maxParam})`
          ).toBe(maxParam);
        }
      });
    });
  }
}
