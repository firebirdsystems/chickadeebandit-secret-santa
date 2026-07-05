-- Secret Santa / Gift Exchange — initial schema
--
-- assignments.receiver_id is masked by column_read_acls (visible_to: ["owner"])
-- so only the giver can ever read who they drew. gift_notes are owner_only with
-- adults_bypass:false — private even from adults, since a note names the recipient.

CREATE TABLE IF NOT EXISTS app_secret_santa__exchanges (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  details       TEXT,
  budget_cents  INTEGER,
  exchange_date TEXT,
  status        TEXT NOT NULL DEFAULT 'open',
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  drawn_at      TEXT,
  revealed_at   TEXT
);

CREATE TABLE IF NOT EXISTS app_secret_santa__participants (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  member_id   TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'everyone',
  hint        TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_secret_santa__assignments (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  giver_id    TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_secret_santa__gift_notes (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  member_id   TEXT NOT NULL,
  body        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_secret_santa__reveals (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  giver_id    TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'everyone',
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ss_participants_exchange ON app_secret_santa__participants(exchange_id);
CREATE INDEX IF NOT EXISTS ss_assignments_exchange  ON app_secret_santa__assignments(exchange_id);
CREATE INDEX IF NOT EXISTS ss_gift_notes_exchange   ON app_secret_santa__gift_notes(exchange_id);
CREATE INDEX IF NOT EXISTS ss_reveals_exchange      ON app_secret_santa__reveals(exchange_id);
