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

// ── "Don't pair" rules ────────────────────────────────────────────────────────
// Rules live in the exclusions table (adult_writable) and are read by the hub's
// secret_draw as forbidden giver/receiver pairs in BOTH directions. They can be
// edited until the exchange is revealed — a re-draw honours the current rules.

export function canEditExclusions(exchange, member) {
  return isAdult(member) && (exchange?.status === "open" || exchange?.status === "drawn");
}

export function exclusionsOf(exchange, exclusions) {
  if (!exchange) return [];
  return exclusions.filter(e => e.exchange_id === exchange.id);
}

/** Order-independent identity of a pair, so A–B and B–A are the same rule. */
export function pairKey(a, b) {
  return [String(a), String(b)].sort().join("|");
}

export function isExcludedPair(exclusions, a, b) {
  const key = pairKey(a, b);
  return exclusions.some(e => pairKey(e.member_a_id, e.member_b_id) === key);
}

/** Pre-check for adding a rule. Returns an error string or null. */
export function exclusionError(a, b, exclusions) {
  if (!a || !b) return "Pick two people.";
  if (a === b) return "Pick two different people.";
  if (isExcludedPair(exclusions, a, b)) return "Those two are already kept apart.";
  return null;
}

/** Human-readable failure for a draw response the hub refused. */
export function drawFailureMessage(json, nameOf = id => id) {
  switch (json?.reason) {
    case "not_enough_participants":
      return "At least 2 participants who are still household members are needed.";
    case "draw_closed":
      return "This exchange can no longer be drawn.";
    case "draw_changed":
      return "The participants or the don't-pair rules changed while the draw was running. Try again.";
    case "too_many_exclusions":
      return "There are too many don't-pair rules for one exchange.";
    case "constraints_too_revealing": {
      // The hub refuses a rule set that leaves someone exactly one possible
      // person: the rules are visible to everyone, so that pairing would
      // already be public before anyone opened their assignment.
      const pinned = (json.over_constrained_member_ids ?? []).map(nameOf).filter(Boolean);
      const who = pinned.length ? ` ${pinned.join(", ")} ${pinned.length === 1 ? "has" : "have"} only one person left` : "Someone has only one person left";
      return `${who.trim()}, so the draw wouldn't be secret — anyone could work it out from the rules. Remove a rule or invite more people.`;
    }
    case "constraints_unsatisfiable": {
      const stuck = (json.over_constrained_member_ids ?? []).map(nameOf).filter(Boolean);
      const who = stuck.length ? ` ${stuck.join(", ")} ${stuck.length === 1 ? "has" : "have"} nobody left to draw.` : "";
      return `The don't-pair rules leave no possible draw.${who} Remove a rule or invite more people.`;
    }
    default:
      return json?.error || "Draw failed.";
  }
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
