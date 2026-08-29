/**
 * Deleting an exchange cleared its assignments through the secret-draw endpoint
 * and then dropped the exchange row — leaving participants and gift notes
 * behind. Neither could be cleaned up afterwards: participants is
 * write_owner_only and gift_notes is owner_only with adults_bypass off, so
 * another member's rows were unreachable by every member including the
 * organizer once the parent was gone. delete_cascades takes them with it.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const schema = ["001_init.sql", "002_exclusions.sql"]
  .map((f) => readFileSync(join(__dirname, "../migrations", f), "utf-8"))
  .join("\n");

describe("delete_cascades", () => {
  it("declares the exchange's participants, gift notes and don't-pair rules", () => {
    expect(manifest.delete_cascades).toEqual({
      exchanges: [
        { table: "participants", foreign_key: "exchange_id" },
        { table: "gift_notes", foreign_key: "exchange_id" },
        { table: "exclusions", foreign_key: "exchange_id" },
      ],
    });
  });

  it("every declared table and foreign key exists in the migrations", () => {
    for (const dep of manifest.delete_cascades.exchanges) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS app_secret_santa__${dep.table}\\s*\\(`));
      expect(schema).toMatch(new RegExp(`\\b${dep.foreign_key}\\b`));
    }
  });

  it("covers exactly the children app SQL cannot reach for another member", () => {
    expect(manifest.row_policies.participants.write_owner_only).toBe(true);
    expect(manifest.row_policies.gift_notes.adults_bypass).toBe(false);
    // assignments stays out: it is endpoint_writes_only and the client clears it
    // through the secret-draw endpoint before deleting the exchange.
    expect(manifest.delete_cascades.exchanges.map((d) => d.table)).not.toContain("assignments");
  });
});
