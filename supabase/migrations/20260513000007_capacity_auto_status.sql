-- Migration: Auto-update trip status based on capacity
-- When current_bookings reaches max_capacity → status becomes 'full' (if was 'advertised')
-- When current_bookings drops below max_capacity → status reverts to 'advertised' (if was 'full')

-- ── Function ────────────────────────────────────────────────────────────────

create or replace function sync_trip_status_on_capacity()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Auto-mark as full only when transitioning from 'advertised' and at capacity
  if new.current_bookings >= new.max_capacity and new.status = 'advertised' then
    new.status := 'full';
  end if;

  -- Auto-revert to 'advertised' when a spot opens up (from 'full' only)
  if new.current_bookings < new.max_capacity and new.status = 'full' then
    new.status := 'advertised';
  end if;

  return new;
end;
$$;

-- ── Trigger ─────────────────────────────────────────────────────────────────

drop trigger if exists trg_trips_capacity_auto_status on trips;

create trigger trg_trips_capacity_auto_status
  before update of current_bookings on trips
  for each row
  execute function sync_trip_status_on_capacity();

-- ── Comment ─────────────────────────────────────────────────────────────────

comment on function sync_trip_status_on_capacity() is
  'Fires on trips.current_bookings updates. Toggles status between ''advertised'' and ''full'' based on capacity. Does not affect other statuses (planned, ongoing, completed, cancelled).';
