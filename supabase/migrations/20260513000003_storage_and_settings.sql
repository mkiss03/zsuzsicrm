-- =============================================================================
-- ZsuzsiCRM — Storage + extended settings migration
-- 1. Supabase Storage bucket for company assets (logo)
-- 2. Storage access policies
-- 3. Seed new settings keys required by the 5-tab settings page
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage bucket: company
-- Public read (logos served without auth), authenticated write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company',
  'company',
  true,
  2097152,   -- 2 MB max
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do nothing;

-- Anyone can read (logos appear on invoices sent to clients)
create policy "company_bucket_public_select"
  on storage.objects for select
  using (bucket_id = 'company');

-- Only authenticated users can upload / update / delete
create policy "company_bucket_auth_write"
  on storage.objects for insert
  with check (auth.role() = 'authenticated' and bucket_id = 'company');

create policy "company_bucket_auth_update"
  on storage.objects for update
  using (auth.role() = 'authenticated' and bucket_id = 'company')
  with check (auth.role() = 'authenticated' and bucket_id = 'company');

create policy "company_bucket_auth_delete"
  on storage.objects for delete
  using (auth.role() = 'authenticated' and bucket_id = 'company');

-- ---------------------------------------------------------------------------
-- Extended settings seed
-- Keys not seeded in earlier migrations.
-- ---------------------------------------------------------------------------
insert into settings (key, value) values
  -- Company / invoice
  ('company_logo_url',         ''),

  -- Billing defaults
  ('payment_deadline_days',    '14'),
  ('invoice_number_start',     '1'),
  ('invoice_default_notes',    ''),

  -- Notification toggles  ('1' = on, '0' = off)
  ('notify_passport_expiry',      '1'),
  ('notify_passport_expiry_days', '60'),
  ('notify_payment_due',          '1'),
  ('notify_payment_due_days',     '3'),
  ('notify_payment_overdue',      '1'),
  ('notify_new_booking',          '1'),
  ('notify_trip_soon',            '1'),
  ('notify_trip_soon_days',       '14'),
  ('notify_low_capacity',         '1'),
  ('notify_low_capacity_spots',   '2'),

  -- Discount levels (stored as JSON array)
  ('discount_levels', '[
    {"level":0,"name":"Alap","minTrips":0,"pct":0},
    {"level":1,"name":"Bronz","minTrips":3,"pct":5},
    {"level":2,"name":"Ezüst","minTrips":5,"pct":10},
    {"level":3,"name":"Arany","minTrips":8,"pct":15}
  ]')
on conflict (key) do nothing;
