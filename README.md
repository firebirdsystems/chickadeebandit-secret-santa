# Secret Santa 🎅

A Chickadee Bandit marketplace app for family and office-style gift exchanges — the flagship app for `column_read_acls`.

## What it does

- Adults create an exchange with an optional budget, exchange date, and details.
- Anyone joins while the exchange is open and leaves a public **gift hint** (sizes, favorite things).
- The organizer runs the **draw**: participants are matched in a single Sattolo cycle (nobody ever draws themself; every participant gives and receives exactly once).
- Each giver sees only **their own** recipient, plus that person's hint and a one-tap hop to the Wish List app.
- Givers keep **private gift-idea notes** that not even adults can read.
- Optionally, the organizer triggers a **post-exchange reveal**: as each participant next opens the app they publish their own pairing, and the full "who had whom" list fills in for everyone.

## How the secret stays secret

The `assignments` table is governed by:

```json
{
  "kind": "adult_writable",
  "member_read_column": "giver_id",
  "column_read_acls": {
    "receiver_id": { "visible_to": ["owner"] }
  }
}
```

- `column_read_acls` masks `receiver_id` to `null` for everyone except the row's giver — **adults get no implicit bypass**, and the hub rejects any SQL that references the column in `WHERE`/`ORDER BY`/expressions, so there is no comparison oracle. Raw `/api/db` calls hit the same wall as the UI.
- Non-adults additionally only see their own assignment row (`member_read_column`).
- `gift_notes` are `owner_only` with `adults_bypass: false` — private even from parents, since a note names the recipient.
- `reveals` rows are inserted by each giver about themselves (`write_owner_only` + `unique_per_member`), so the reveal is opt-in-by-open and nobody can publish someone else's pairing.

**Known limitation:** the draw itself runs in the organizer's browser (an adult, per `adult_writable`). The pairing exists only inside the `runDraw` function and is never rendered or stored client-side, but a determined organizer could observe it with devtools at draw time. Everything *at rest* is owner-masked. Making the draw fully trustless would require a hub-side draw endpoint (a `random_assignments` protocol) — a candidate hub enhancement.

## Status flow

`open` (joining) → `drawn` (assignments live, joins closed by UI) → `revealed` (pairings publish as members open the app) → `archived`. `Re-draw` is available while drawn; delete removes the exchange and its assignments.

## Development

```bash
npm install
npm run dev     # local dev server on :3001 (demo data, no hub)
npm test        # vitest — draw properties, gates, manifest contract
npm run build   # validates manifest + migrations → dist/bundle.json
```
