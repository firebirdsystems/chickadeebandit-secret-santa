-- Pairings whose exchange is gone.
--
-- Until delete_cascades.exchanges listed assignments, deleting an exchange
-- through /api/db left its pairings behind (the page clears them through the
-- hub first; a raw DELETE did not). An exchange re-created at the same id then
-- sealed a revealed draw again. The cascade now takes them with the exchange;
-- this clears what earlier deletes left.
--
-- `exchange_id` and `id` are plaintext (`_id` suffix, built-in `id`).
DELETE FROM app_secret_santa__assignments WHERE exchange_id NOT IN (SELECT id FROM app_secret_santa__exchanges);
