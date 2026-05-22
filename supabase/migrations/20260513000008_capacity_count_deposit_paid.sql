-- Migration: Only count deposit_paid, fully_paid, completed bookings toward trip capacity.
-- Previously the trigger counted everything except 'interested' and 'cancelled',
-- meaning 'booked' (confirmed but not yet paid) also held a slot.
-- Now a booking only occupies a capacity slot once the deposit is received.

create or replace function sync_trip_bookings()
returns trigger language plpgsql security definer as $$
begin
  update trips t
  set current_bookings = (
    select count(*)
    from   bookings b
    where  b.trip_id    = t.id
      and  b.deleted_at is null
      and  b.status in ('deposit_paid', 'fully_paid', 'completed')
  )
  where t.id = coalesce(new.trip_id, old.trip_id);

  return coalesce(new, old);
end;
$$;
