# Secret Santa 🎅

A Chickadee Bandit marketplace app for family and office-style gift exchanges — the flagship app for the hub's `secret_draw` protocol.

## What it does

- Adults create an exchange with an optional budget, exchange date, and details.
- Anyone joins while the exchange is open and leaves a public **gift hint** (sizes, favorite things).
- The organizer runs the **draw**: the hub matches participants in a single Sattolo cycle **server-side** (nobody ever draws themself; every participant gives and receives exactly once) and stores the assignments itself.
- Each giver sees only **their own** recipient, plus that person's hint and a one-tap hop to the Wish List app.
- Givers keep **private gift-idea notes** that not even adults can read.
- Optionally, the organizer triggers a **post-exchange reveal**: everyone immediately sees the authoritative "who had whom" list.

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
