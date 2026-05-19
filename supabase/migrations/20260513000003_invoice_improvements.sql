-- =============================================================================
-- Invoice improvements
-- 1. RE-YYYY-NNNN number format (Austrian Rechnung standard)
-- 2. New settings: UID-Nummer, IBAN, BIC, legal name
-- =============================================================================

-- New invoice number generator — RE-2024-0001 format
create or replace function generate_re_invoice_number()
returns text language plpgsql as $$
declare
  v_year text  := extract(year from now())::text;
  v_seq  bigint;
begin
  select nextval('seq_invoice_number') into v_seq;
  return 'RE-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Replace default on invoices.invoice_number
alter table invoices
  alter column invoice_number set default generate_re_invoice_number();

-- Austrian-specific settings
insert into settings (key, value) values
  ('agency_legal_name',  'UtazóFotós – Tuza-Göncz Zsuzsanna'),
  ('agency_street',      ''),
  ('agency_zip',         ''),
  ('agency_city',        ''),
  ('agency_country',     'Ausztria'),
  ('uid_nummer',         'ATU00000000'),
  ('iban',               'AT00 0000 0000 0000 0000'),
  ('bic',                'XXXXXXXX'),
  ('bank_name',          ''),
  ('invoice_due_days',   '14'),
  ('invoice_footer_text', 'Vielen Dank für Ihr Vertrauen!')
on conflict (key) do nothing;
