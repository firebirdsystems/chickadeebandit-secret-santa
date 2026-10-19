-- Archiving moves out of `status` into its own column.
--
-- `status` now belongs to the hub: it is what releases the sealed_until policy
-- on assignments, so the manifest closes it to app writes and only the
-- secret_draw endpoints move it (draw: open → drawn; reveal: drawn → revealed,
-- creator only). An app that could write it could flip an exchange to
-- 'revealed', read every pairing, and flip it back. Archiving is the app's own
-- bookkeeping, so it gets the app's own column.
--
-- Plain column-to-column SQL only: migrations run outside the app-DB codec, and
-- every column touched here is plaintext (the _at suffix).
ALTER TABLE app_secret_santa__exchanges ADD COLUMN archived_at TEXT;

-- Existing archived exchanges keep their place in the archive and get back the
-- status they ended in. One that was revealed before archiving shows its
-- pairings again — everyone had already seen them.
UPDATE app_secret_santa__exchanges
SET archived_at = COALESCE(revealed_at, drawn_at, created_at),
    status = CASE
      WHEN revealed_at IS NOT NULL THEN 'revealed'
      WHEN drawn_at IS NOT NULL THEN 'drawn'
      ELSE 'open'
    END
WHERE status = 'archived';
