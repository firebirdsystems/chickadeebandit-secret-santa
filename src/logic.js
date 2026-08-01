import { isAdult } from "./shared.js";
export { isAdult };

export const STATUS_LABELS = {
  open:     "Open — joining",
  drawn:    "Drawn 🎩",
  revealed: "Revealed",
  archived: "Archived",
};

export function statusLabel(exchange) {
  return STATUS_LABELS[exchange?.status] ?? exchange?.status ?? "";
}

/** Mirrors the adult_writable policy on exchanges and the secret_draw write_acl. */
export function canManageExchange(member) {
  return isAdult(member);
}

export function canJoin(exchange, participants, member) {
  if (!member || !exchange || exchange.status !== "open") return false;
  return !participants.some(p => p.exchange_id === exchange.id && p.member_id === member.id);
}

export function canLeave(exchange, participants, member) {
  if (!member || !exchange || exchange.status !== "open") return false;
  return participants.some(p => p.exchange_id === exchange.id && p.member_id === member.id);
}

export function myParticipant(exchange, participants, member) {
  if (!member || !exchange) return null;
  return participants.find(p => p.exchange_id === exchange.id && p.member_id === member.id) ?? null;
}

/**
 * The caller's own assignment row. Under sealed_until, pre-reveal reads return
 * ONLY the caller's row; post-reveal they return everyone's — filter by giver.
 * The pairing itself is computed by the hub's secret_draw endpoint; it never
 * exists in any client, this one included.
 */
export function myAssignment(exchange, assignments, member) {
  if (!member || !exchange) return null;
  return assignments.find(a =>
    a.exchange_id === exchange.id && a.giver_id === member.id
  ) ?? null;
}

/**
 * Client-side pre-check that a participant list is drawable (the server
 * independently enforces this). Returns an error string or null.
 * Two participants is a legal (mutual) exchange; three or more is recommended.
 */
export function drawError(participantIds) {
  const unique = new Set(participantIds);
  if (unique.size !== participantIds.length) return "Duplicate participants in the draw.";
  if (unique.size < 2) return "At least 2 participants are needed to draw.";
  return null;
}

export function fmtBudget(cents) {
  if (cents == null || cents === "") return null;
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return null;
  const dollars = n / 100;
  return `$${Number.isInteger(dollars) ? dollars.toLocaleString() : dollars.toFixed(2)}`;
}

export function parseBudgetInput(text) {
  const t = String(text ?? "").trim().replace(/^\$/, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * An exchange is found again by its details — the year, the group,
 * the budget note — as much as by its title.
 */
export function searchableFields(item) {
  return [item.title, item.details];
}
