# Secret Santa 🎅

A Chickadee Bandit marketplace app for family and office-style gift exchanges — the flagship app for the hub's `secret_draw` protocol.

## What it does

- Adults create an exchange with an optional budget, exchange date, and details.
- Anyone joins while the exchange is open and leaves a public **gift hint** (sizes, favorite things).
- The organizer runs the **draw**: the hub matches participants **server-side** (nobody ever draws themself; every participant gives and receives exactly once) and stores the assignments itself.
- Each giver sees only **their own** recipient, plus that person's hint and a one-tap hop to the Wish List app.
- Givers keep **private gift-idea notes** that not even adults can read.
- Optionally, the organizer triggers a **post-exchange reveal**: everyone immediately sees the authoritative "who had whom" list.
- **Don't-pair rules**: adults keep spouses (or anyone who already exchanges) from drawing each other. Rules are read by the hub at draw time and apply in both directions.

## How the secret stays secret

The draw is performed by the hub's generic `secret_draw` endpoint (`POST api/secret-draw`), declared in the manifest. The pairing is computed and inserted entirely server-side and the response carries no pairing data — **it never exists in any browser, the organizer's included**, so there is nothing for devtools or the network tab to observe.

At rest, the `assignments` table is governed by:

```json
{
  "kind": "sealed_until",
  "fk_column": "exchange_id",
  "parent_table": "exchanges",
  "writer_column": "giver_id",
  "parent_status_column": "status",
  "visible_parent_status_values": ["revealed"],
  "endpoint_writes_only": true
}
```

- `sealed_until` lets each giver read **only their own row** until the exchange status becomes `revealed` — **adults get no implicit bypass**. Raw `/api/db` calls hit the same wall as the UI.
- `endpoint_writes_only` blocks ALL app-originated writes: nobody can forge, edit, or delete an assignment via SQL — the hub endpoint is the only writer (manifest validation enforces this pairing).
- On reveal, the policy releases the **authoritative** assignment rows to everyone at once. Nothing is self-reported and nothing waits on other members opening the app.
- `gift_notes` are `owner_only` with `adults_bypass: false` — private even from parents, since a note names the recipient.
- Participants who have left the household are excluded from the draw server-side (`excluded_member_ids` in the response), so a stale row can't deadlock it.

## Don't-pair rules

Declared on the manifest's `secret_draw` block and enforced by the hub, never the client:

```json
"exclusions": { "table": "exclusions", "scope_column": "exchange_id", "member_a_column": "member_a_id", "member_b_column": "member_b_id" }
```

- Rows are `adult_writable`: everyone can read them (a rule says nothing about who has whom), adults add and remove them until the exchange is revealed. A rule naming someone who hasn't joined is inert.
- The hub prefers a single cycle (everyone in one chain) and falls back to smaller loops when the rules make one chain impossible. When no valid draw exists at all it answers `409 constraints_unsatisfiable`, naming the people left with nobody to draw, and writes nothing.
- The rules are re-asserted **inside the write transaction**: a rule added while a draw is being computed makes the batch fail with `409 draw_changed` rather than commit a pairing the current rules forbid.
- Rules that leave anyone **exactly one** possible person are refused with `409 constraints_too_revealing`, naming them. The rules are readable by every member, so a mapping they uniquely determine is a mapping everyone can already work out — two rules over four people are enough to do it. The hub will not hand out a pairing that is already public. (This bounds the sharpest case only: rules can still narrow the field without pinning any single person.)
- Small groups constrain quickly — three people have only two possible draws, and two have only one — so a dense rule set can leave nothing legal. The refusal says who is stuck. Two-person exchanges are exempt from the pinning rule: their pairing is arithmetic, not a leak.

## Status flow

`open` (joining) → `drawn` (assignments live, joins closed by UI; re-draw allowed) → `revealed` (all pairings visible) → `archived`. Delete clears the assignments through `api/secret-draw/clear` (app SQL cannot touch the table), then removes the exchange.

## Development

```bash
npm install
npm run dev     # local dev server on :3001 (demo data, no hub)
npm test        # vitest — gates, formatting, manifest contract
npm run build   # validates manifest + migrations → dist/bundle.json
```

The draw's derangement properties are tested hub-side in
`packages/hub/__tests__/unit/secret-draw.test.ts`.

`ui-scenarios.json` drives this app's own UI inside the real hub (Layer 3b), so the
row policies above are asserted against what a member's browser actually renders —
a giver seeing only their own assignment before the reveal, everyone seeing all of
them after, and a child reading the don't-pair rules without being able to edit them.
Run it from `packages/hub`:

```bash
npx playwright test -c e2e/playwright.config.ts --project=app-ui -g "app-ui: secret-santa"
```
