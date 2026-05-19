-- =============================================================================
-- ZsuzsiCRM — Booking Workflow & E-Signature System
--
-- Two new tables:
--   1. booking_contracts  — Document sent to client for e-signature.
--                           One row per document per booking. Stores the
--                           exact text the client saw + their signature data.
--   2. workflow_steps     — Tracks per-booking workflow state. One row per
--                           step_key per booking. Lazy-initialized when the
--                           workflow tab is first opened.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. booking_contracts
-- ---------------------------------------------------------------------------

create table booking_contracts (
  id             uuid        primary key default gen_random_uuid(),
  booking_id     uuid        not null references bookings(id) on delete cascade,

  -- Unique opaque token used in the public sign URL (/sign/{token})
  token          text        not null unique default encode(gen_random_bytes(32), 'hex'),

  -- What kind of document this is
  document_type  text        not null default 'travel_contract',
  document_title text        not null default 'Utazási szerződés és nyilatkozat',

  -- The full body of the document exactly as the client sees it
  document_body  text        not null,

  -- Lifecycle
  status         text        not null default 'pending'
                             check (status in ('pending','signed','expired','cancelled')),

  -- Signature data (filled in when client signs)
  signed_name    text,
  signed_at      timestamptz,
  signed_ip      text,
  signed_ua      text,

  -- Link expires after this time (default 14 days)
  expires_at     timestamptz not null default (now() + interval '14 days'),

  -- Delivery tracking
  sent_at        timestamptz,
  email_sent_to  text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Fast token lookup (used by the public sign API on every request)
create unique index idx_booking_contracts_token
  on booking_contracts (token);

-- Booking-level listing
create index idx_booking_contracts_booking_id
  on booking_contracts (booking_id);

-- RLS: only authenticated dashboard users read/write via Supabase client.
-- The public sign API uses service_role and bypasses RLS intentionally.
alter table booking_contracts enable row level security;

create policy "booking_contracts_auth_all"
  on booking_contracts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 2. workflow_steps
-- ---------------------------------------------------------------------------

-- Ordered step keys (their display order is enforced in application code):
--   contract_send          → Admin sends the contract link
--   contract_sign          → Client signs (auto-triggered by /api/sign)
--   deposit_request        → Admin sends deposit payment request email
--   deposit_paid           → Deposit received (auto-triggered on payment)
--   docs_verify            → Admin checks passport / travel documents
--   full_payment_request   → Admin sends final payment reminder
--   full_paid              → Final payment received (auto-triggered on payment)
--   pre_trip_send          → Admin sends pre-trip briefing email

create table workflow_steps (
  id           uuid        primary key default gen_random_uuid(),
  booking_id   uuid        not null references bookings(id) on delete cascade,

  step_key     text        not null,

  status       text        not null default 'pending'
               check (status in ('pending','done','skipped','blocked')),

  done_at      timestamptz,

  -- Who/what completed this step: 'auto' | 'admin' | 'client'
  triggered_by text,

  notes        text,

  -- Optional reference to the related entity (e.g. contract id, payment id)
  related_id   uuid,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Only one record per step per booking
  unique (booking_id, step_key)
);

create index idx_workflow_steps_booking_id
  on workflow_steps (booking_id);

alter table workflow_steps enable row level security;

create policy "workflow_steps_auth_all"
  on workflow_steps for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 3. updated_at helper (create if not already defined by an earlier migration)
-- ---------------------------------------------------------------------------

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. updated_at triggers
-- ---------------------------------------------------------------------------

create trigger trg_booking_contracts_updated_at
  before update on booking_contracts
  for each row execute function update_updated_at_column();

create trigger trg_workflow_steps_updated_at
  before update on workflow_steps
  for each row execute function update_updated_at_column();
