-- =============================================================================
-- Website ↔ CRM trip sync fields
--
-- Adds three nullable columns to trips so that trips imported from the website
-- (utazofotos.com) can be tracked by their origin IDs and kept in sync via a
-- Supabase Database Webhook on the website's departures / destinations tables.
--
-- external_id            : departures.id   from the website Supabase project
-- external_destination_id: destinations.id from the website Supabase project
-- external_source        : 'website' | NULL (NULL = created directly in CRM)
-- =============================================================================

alter table trips
  add column if not exists external_id             uuid,
  add column if not exists external_destination_id uuid,
  add column if not exists external_source         text;

-- Unique index on external_id (only for non-null rows so CRM-created trips
-- with external_id = NULL don't conflict with each other).
create unique index if not exists trips_external_id_unique
  on trips (external_id)
  where external_id is not null;

-- Speed up "update all trips for a destination" queries
create index if not exists trips_external_destination_id_idx
  on trips (external_destination_id)
  where external_destination_id is not null;
