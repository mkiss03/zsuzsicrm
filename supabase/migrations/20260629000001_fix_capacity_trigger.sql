-- Fix: count all non-cancelled bookings toward trip capacity (not just paid ones)
create or replace function sync_trip_bookings()
returns trigger language plpgsql security definer as $$
begin
  update trips t
  set current_bookings = (
    select coalesce(sum(b.party_size), 0)
    from   bookings b
    where  b.trip_id    = t.id
      and  b.deleted_at is null
      and  b.status <> 'cancelled'
  )
  where t.id = coalesce(new.trip_id, old.trip_id);

  return coalesce(new, old);
end;
$$;
