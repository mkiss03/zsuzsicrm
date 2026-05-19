-- =============================================================================
-- ZsuzsiCRM — Addendum migration
-- 1. Enable Supabase Realtime on notifications table
-- 2. Seed extended settings keys required for invoice PDF generation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Realtime: add notifications to the publication so that INSERT/UPDATE events
-- are broadcast to connected clients (useNotifications + NotificationsDropdown).
-- The publication is created by Supabase automatically; we only need to add our
-- table to it.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Only add if not already a member (idempotent)
  if not exists (
    select 1
    from   pg_publication_tables
    where  pubname   = 'supabase_realtime'
      and  tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extended settings seed
-- These keys are consumed by useInvoices.getAgencySettings() and the invoice
-- PDF renderer.  The ON CONFLICT DO NOTHING guard makes this migration safe to
-- re-run against a database that already has these rows.
-- ---------------------------------------------------------------------------
insert into settings (key, value) values
  ('agency_legal_name',   ''),
  ('agency_street',       ''),
  ('agency_zip',          ''),
  ('agency_city',         ''),
  ('agency_country',      'Ausztria'),
  ('uid_nummer',          ''),
  ('iban',                ''),
  ('bic',                 ''),
  ('bank_name',           ''),
  ('invoice_footer_text', 'Vielen Dank für Ihr Vertrauen!')
on conflict (key) do nothing;
