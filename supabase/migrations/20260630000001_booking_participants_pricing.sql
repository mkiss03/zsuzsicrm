-- Add per-participant pricing fields to booking_participants
alter table booking_participants
  add column if not exists unit_price        numeric(10,2),
  add column if not exists discount_percentage numeric(5,2) not null default 0,
  add column if not exists discount_amount   numeric(10,2) not null default 0,
  add column if not exists final_price       numeric(10,2);
