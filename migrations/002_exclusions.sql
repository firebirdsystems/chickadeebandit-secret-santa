-- "Don't pair" rules.
--
-- exclusions: one row per pair of people who must not draw each other (spouses,
-- people who already exchange). Read by the hub's secret_draw at draw time as a
-- forbidden giver/receiver edge in BOTH directions; adult_writable like the
-- exchange itself. A rule naming someone who hasn't joined is simply inert.
--
CREATE TABLE IF NOT EXISTS app_secret_santa__exclusions (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  member_a_id TEXT NOT NULL,
  member_b_id TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ss_exclusions_exchange ON app_secret_santa__exclusions(exchange_id);
