-- =============================================================================
-- Trip itinerary items — day-by-day programme builder
-- =============================================================================

create table trip_itinerary_items (
  id          uuid        primary key default gen_random_uuid(),
  trip_id     uuid        not null references trips (id) on delete cascade,
  day_date    date        not null,
  time_of_day text,                        -- e.g. "09:00" (optional)
  description text        not null,
  type        text        not null default 'other'
              check (type in ('flight','hotel','activity','meal','transfer','other')),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_itinerary_trip_day  on trip_itinerary_items (trip_id, day_date, sort_order);

alter table trip_itinerary_items enable row level security;
create policy "itinerary_service_all"      on trip_itinerary_items for all using (auth.role() = 'service_role');
create policy "itinerary_authenticated_all" on trip_itinerary_items for all using (auth.role() = 'authenticated');
grant select, insert, update, delete on trip_itinerary_items to authenticated, service_role;

-- =============================================================================
-- Supabase Storage bucket for trip documents
-- =============================================================================

-- The bucket is created here as SQL so it's reproducible in CI/CD.
-- bucket must be created via Supabase dashboard OR via the management API;
-- the insert below works when using the Supabase storage schema extension.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-documents',
  'trip-documents',
  false,
  52428800,   -- 50 MB per file
  array['application/pdf','image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

create policy "trip_docs_authenticated_select"
  on storage.objects for select
  using (bucket_id = 'trip-documents' and auth.role() = 'authenticated');

create policy "trip_docs_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'trip-documents' and auth.role() = 'authenticated');

create policy "trip_docs_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'trip-documents' and auth.role() = 'authenticated');
