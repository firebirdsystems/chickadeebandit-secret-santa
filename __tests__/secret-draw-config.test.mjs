/**
 * The manifest's secret_draw block names tables and columns the hub reads at
 * draw time. A rename in a migration that the manifest misses would only fail
 * on a real household's first draw, so pin the two together here.
 */
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const migrationsDir = join(__dirname, "../migrations");
const schema = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf-8"))
  .join("\n");

const PREFIX = "app_secret_santa__";
const createTable = (table) => new RegExp(`CREATE TABLE IF NOT EXISTS ${PREFIX}${table}\\s*\\(([^;]*)\\)`, "s");
const hasColumn = (table, column) => {
  const body = schema.match(createTable(table))?.[1] ?? "";
  const inline = new RegExp(`^\\s*${column}\\s`, "m").test(body);
  const added = new RegExp(`ALTER TABLE ${PREFIX}${table} ADD COLUMN ${column}\\b`).test(schema);
  return inline || added;
};

describe("secret_draw ↔ migrations", () => {
  const draw = manifest.secret_draw;

  it("declares don't-pair rules", () => {
    expect(draw.exclusions).toEqual({
      table: "exclusions",
      scope_column: "exchange_id",
      member_a_column: "member_a_id",
      member_b_column: "member_b_id",
    });
  });

  it("every table and column the draw reads exists in the migrations", () => {
    expect(hasColumn(draw.parent_table, draw.parent_status_column)).toBe(true);
    expect(hasColumn(draw.parent_table, draw.drawn_at_column)).toBe(true);
    expect(hasColumn(draw.participant_table, draw.participant_scope_column)).toBe(true);
    expect(hasColumn(draw.participant_table, draw.participant_member_column)).toBe(true);
    for (const column of [draw.assignment_scope_column, draw.giver_column, draw.receiver_column, draw.created_at_column]) {
      expect(hasColumn(draw.assignments_table, column)).toBe(true);
    }
    const ex = draw.exclusions;
    for (const column of [ex.scope_column, ex.member_a_column, ex.member_b_column]) {
      expect(hasColumn(ex.table, column)).toBe(true);
    }
    // The hub filters exclusion rows by scope — never a table scan.
    expect(schema).toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS \\w+ ON ${PREFIX}${ex.table}\\(${ex.scope_column}\\)`));
  });

  it("keeps the sealed_until policy aligned with the draw's own relationship", () => {
    const policy = manifest.row_policies.assignments;
    expect(policy.kind).toBe("sealed_until");
    expect(policy.parent_table).toBe(draw.parent_table);
    expect(policy.fk_column).toBe(draw.assignment_scope_column);
    expect(draw.parent_id_column ?? "id").toBe("id");
    expect(policy.visible_parent_status_values).toEqual(["revealed"]);
  });

  it("keeps the exclusions table editable by adults, deleted with the exchange, and pruned with members", () => {
    expect(manifest.row_policies.exclusions).toEqual({ kind: "adult_writable" });
    expect(manifest.delete_cascades.exchanges).toContainEqual({ table: "exclusions", foreign_key: "exchange_id" });
    expect(manifest.member_references.exclusions).toEqual([
      { column: "member_a_id", on_removed: "delete" },
      { column: "member_b_id", on_removed: "delete" },
      // Display-only: a rule outlives the adult who wrote it.
      { column: "created_by", on_removed: "keep" },
    ]);
  });

  it("the draw's scope and member columns are plaintext by naming convention", () => {
    // `_id`-suffixed columns are plaintext without being listed; anything else
    // the hub matches in SQL would need db_plaintext_columns.
    for (const column of [
      draw.exclusions.scope_column, draw.exclusions.member_a_column, draw.exclusions.member_b_column,
    ]) {
      expect(column.endsWith("_id")).toBe(true);
    }
  });
});
