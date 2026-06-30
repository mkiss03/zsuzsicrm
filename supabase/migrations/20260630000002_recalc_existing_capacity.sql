-- One-time backfill: recalculate current_bookings for all existing trips
-- (the trigger fix in 20260629000001 only affects future insert/update/delete,
-- not rows that were already out of sync)
update trips t
set current_bookings = (
  select coalesce(sum(b.party_size), 0)
  from bookings b
  where b.trip_id = t.id
    and b.deleted_at is null
    and b.status <> 'cancelled'
);
