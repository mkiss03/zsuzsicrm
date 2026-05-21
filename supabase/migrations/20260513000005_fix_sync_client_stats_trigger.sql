-- =============================================================================
-- Fix: sync_client_stats() crashes on payments table because payments has no
-- client_id column. Resolve client_id via bookings when firing from payments.
-- =============================================================================

create or replace function sync_client_stats()
returns trigger language plpgsql security definer as $$
declare
  v_client_id uuid;
begin
  -- payments rows don't have client_id directly; look it up via booking_id
  if TG_TABLE_NAME = 'payments' then
    select b.client_id into v_client_id
    from   bookings b
    where  b.id = coalesce(new.booking_id, old.booking_id);
  else
    -- bookings rows have client_id directly
    v_client_id := coalesce(new.client_id, old.client_id);
  end if;

  if v_client_id is null then
    return coalesce(new, old);
  end if;

  update clients c
  set
    trip_count  = (
      select count(*)
      from   bookings b
      where  b.client_id  = c.id
        and  b.deleted_at is null
        and  b.status not in ('interested','cancelled')
    ),
    total_spent = (
      select coalesce(sum(p.amount), 0)
      from   payments p
      join   bookings b on b.id = p.booking_id
      where  b.client_id = c.id
        and  p.type     != 'refund'
    ) - (
      select coalesce(sum(p.amount), 0)
      from   payments p
      join   bookings b on b.id = p.booking_id
      where  b.client_id = c.id
        and  p.type      = 'refund'
    )
  where c.id = v_client_id;

  return coalesce(new, old);
end;
$$;
