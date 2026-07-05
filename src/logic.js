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

/** Mirrors the adult_writable policy on exchanges and assignments. */
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

export function myAssignment(exchange, assignments, member) {
  if (!member || !exchange) return null;
  return assignments.find(a =>
    a.exchange_id === exchange.id && a.giver_id === member.id && a.receiver_id != null
  ) ?? null;
}

/**
 * Validates a participant list is drawable. Returns an error string or null.
 * Two participants is a legal (mutual) exchange; three or more is recommended.
 */
export function drawError(participantIds) {
  const unique = new Set(participantIds);
  if (unique.size !== participantIds.length) return "Duplicate participants in the draw.";
  if (unique.size < 2) return "At least 2 participants are needed to draw.";
  return null;
}

/** Default RNG: uniform integer in [0, n) via crypto when available. */
export function randomInt(n) {
  if (globalThis.crypto?.getRandomValues) {
    const max = Math.floor(0xffffffff / n) * n;
    const buf = new Uint32Array(1);
    do { globalThis.crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

/**
 * Sattolo's algorithm: shuffles ids into a single cycle, so following
 * giver → receiver visits every participant exactly once and nobody ever
 * draws themself. `rng(n)` must return an integer in [0, n).
 *
 * Returns [{ giver_id, receiver_id }, ...] — one pair per participant.
 */
export function buildAssignments(participantIds, rng = randomInt) {
  const err = drawError(participantIds);
  if (err) throw new Error(err);
  const cycle = [...participantIds];
  for (let i = cycle.length - 1; i > 0; i--) {
    const j = rng(i); // strictly less than i — this is what forbids fixed points
    [cycle[i], cycle[j]] = [cycle[j], cycle[i]];
  }
  return cycle.map((giver, i) => ({
    giver_id: giver,
    receiver_id: cycle[(i + 1) % cycle.length],
  }));
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
