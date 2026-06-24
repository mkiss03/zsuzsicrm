-- =============================================================================
-- Group Booking: booking_participants table + party_size on bookings
-- =============================================================================

-- Add party_size to bookings (default 1 for backwards compatibility)
alter table bookings
  add column if not exists party_size integer not null default 1
    check (party_size >= 1);

-- Create booking_participants table
create table if not exists booking_participants (
  id         uuid        primary key default gen_random_uuid(),
  booking_id uuid        not null references bookings (id) on delete cascade,
  client_id  uuid        references clients (id) on delete set null,
  name       text        not null,
  is_lead    boolean     not null default false,
  notes      text,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_bp_booking_id on booking_participants (booking_id);
create index idx_bp_client_id  on booking_participants (client_id) where client_id is not null;

-- RLS
alter table booking_participants enable row level security;

create policy "bp_service_all"
  on booking_participants for all
  using (auth.role() = 'service_role');

create policy "bp_authenticated_all"
  on booking_participants for all
  using (auth.role() = 'authenticated');

-- Grants
grant select, insert, update, delete
  on booking_participants
  to authenticated, service_role;

-- Update capacity trigger: count sum of party_size instead of count(*)
create or replace function sync_trip_bookings()
returns trigger language plpgsql security definer as $$
begin
  update trips t
  set current_bookings = (
    select coalesce(sum(b.party_size), 0)
    from   bookings b
    where  b.trip_id    = t.id
      and  b.deleted_at is null
      and  b.status in ('deposit_paid', 'fully_paid', 'completed')
  )
  where t.id = coalesce(new.trip_id, old.trip_id);

  return coalesce(new, old);
end;
$$;
