-- Drop the global unique constraint on clients.email and replace it with a
-- partial unique index that only considers non-deleted rows.
-- This allows soft-deleted clients' emails to be reused.

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_unique
  ON clients (email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;
