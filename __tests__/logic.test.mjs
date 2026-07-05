import { describe, it, expect } from "vitest";
import {
  buildAssignments,
  drawError,
  canManageExchange,
  canJoin,
  canLeave,
  myAssignment,
  statusLabel,
  fmtBudget,
  parseBudgetInput,
} from "../src/logic.js";

const adult = { id: "a1", name: "Alex", role: "adult" };
const child = { id: "c1", name: "Casey", role: "child" };

describe("buildAssignments (Sattolo cycle)", () => {
  const ids = ["m1", "m2", "m3", "m4", "m5"];

  it("never assigns anyone to themself", () => {
    for (let run = 0; run < 200; run++) {
      for (const { giver_id, receiver_id } of buildAssignments(ids)) {
        expect(giver_id).not.toBe(receiver_id);
      }
    }
  });

  it("every participant gives exactly once and receives exactly once", () => {
    for (let run = 0; run < 50; run++) {
      const pairs = buildAssignments(ids);
      expect(pairs.map(p => p.giver_id).sort()).toEqual([...ids].sort());
      expect(pairs.map(p => p.receiver_id).sort()).toEqual([...ids].sort());
    }
  });

  it("forms a single cycle covering all participants", () => {
    const pairs = buildAssignments(ids);
    const next = new Map(pairs.map(p => [p.giver_id, p.receiver_id]));
    const seen = new Set();
    let cur = ids[0];
    while (!seen.has(cur)) { seen.add(cur); cur = next.get(cur); }
    expect(seen.size).toBe(ids.length);
  });

  it("handles exactly two participants (mutual exchange)", () => {
    const pairs = buildAssignments(["m1", "m2"]);
    expect(pairs).toHaveLength(2);
    for (const p of pairs) expect(p.giver_id).not.toBe(p.receiver_id);
  });

  it("is deterministic under a seeded rng", () => {
    const rng = () => 0;
    expect(buildAssignments(["a", "b", "c"], rng)).toEqual(buildAssignments(["a", "b", "c"], rng));
  });

  it("throws for fewer than two participants", () => {
    expect(() => buildAssignments([])).toThrow();
    expect(() => buildAssignments(["m1"])).toThrow();
  });

  it("throws for duplicate participants", () => {
    expect(() => buildAssignments(["m1", "m1", "m2"])).toThrow();
  });
});

describe("drawError", () => {
  it("rejects short and duplicate lists, accepts valid ones", () => {
    expect(drawError([])).toBeTruthy();
    expect(drawError(["m1"])).toBeTruthy();
    expect(drawError(["m1", "m1"])).toBeTruthy();
    expect(drawError(["m1", "m2"])).toBeNull();
  });
});

describe("gates", () => {
  const exchange = { id: "e1", status: "open" };
  const participants = [{ id: "p1", exchange_id: "e1", member_id: "c1" }];

  it("canManageExchange mirrors adult_writable", () => {
    expect(canManageExchange(adult)).toBe(true);
    expect(canManageExchange(child)).toBe(false);
    expect(canManageExchange(null)).toBe(false);
  });

  it("canJoin only while open and not already joined", () => {
    expect(canJoin(exchange, participants, adult)).toBe(true);
    expect(canJoin(exchange, participants, child)).toBe(false);
    expect(canJoin({ ...exchange, status: "drawn" }, participants, adult)).toBe(false);
    expect(canJoin(exchange, participants, null)).toBe(false);
  });

  it("canLeave only while open and joined", () => {
    expect(canLeave(exchange, participants, child)).toBe(true);
    expect(canLeave(exchange, participants, adult)).toBe(false);
    expect(canLeave({ ...exchange, status: "drawn" }, participants, child)).toBe(false);
  });
});

describe("myAssignment", () => {
  const exchange = { id: "e1", status: "drawn" };

  it("returns own row with a readable receiver", () => {
    const rows = [{ id: "a", exchange_id: "e1", giver_id: "c1", receiver_id: "m9" }];
    expect(myAssignment(exchange, rows, child)?.receiver_id).toBe("m9");
  });

  it("ignores rows whose receiver_id was masked to null by column_read_acls", () => {
    const rows = [{ id: "a", exchange_id: "e1", giver_id: "a1", receiver_id: null }];
    expect(myAssignment(exchange, rows, adult)).toBeNull();
  });
});

describe("formatting", () => {
  it("statusLabel falls back to raw status", () => {
    expect(statusLabel({ status: "open" })).toMatch(/Open/);
    expect(statusLabel({ status: "weird" })).toBe("weird");
  });

  it("fmtBudget renders whole and fractional dollars", () => {
    expect(fmtBudget(2500)).toBe("$25");
    expect(fmtBudget(2550)).toBe("$25.50");
    expect(fmtBudget(null)).toBeNull();
    expect(fmtBudget(0)).toBeNull();
  });

  it("parseBudgetInput round-trips dollars to cents", () => {
    expect(parseBudgetInput("25")).toBe(2500);
    expect(parseBudgetInput("$25.50")).toBe(2550);
    expect(parseBudgetInput("")).toBeNull();
    expect(parseBudgetInput("-5")).toBeNull();
    expect(parseBudgetInput("abc")).toBeNull();
  });
});
