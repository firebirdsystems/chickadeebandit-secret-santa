import { describe, it, expect } from "vitest";
import {
  drawError,
  canManageExchange,
  canJoin,
  canLeave,
  myAssignment,
  statusLabel,
  fmtBudget,
  parseBudgetInput, searchableFields,
} from "../src/logic.js";

const adult = { id: "a1", name: "Alex", role: "adult" };
const child = { id: "c1", name: "Casey", role: "child" };

// The draw itself (Sattolo derangement) lives in the hub's secret_draw
// endpoint — computing it client-side would hand the organizer's browser the
// full pairing. See packages/hub __tests__/unit/secret-draw.test.ts.

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

  it("ignores other members' rows (visible post-reveal under sealed_until)", () => {
    const rows = [{ id: "a", exchange_id: "e1", giver_id: "c1", receiver_id: "m9" }];
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

describe("searchableFields", () => {
  it("matches on the details, not just the exchange title", () => {
    expect(searchableFields({ title: "Christmas", details: "£20 budget, cousins only" }))
      .toContain("£20 budget, cousins only");
  });
});
