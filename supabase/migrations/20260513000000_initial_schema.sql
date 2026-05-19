-- =============================================================================
-- ZsuzsiCRM – Travel Agency CRM
-- Initial schema migration
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fuzzy-text search on names

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Automatically bump updated_at on any table that has the column
create or replace function trigger_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Generate a human-readable sequential code  e.g. CLI-00042
create or replace function generate_code(prefix text, seq_val bigint)
returns text language sql immutable as $$
  select prefix || '-' || lpad(seq_val::text, 5, '0');
$$;

-- ---------------------------------------------------------------------------
-- Sequences for human-readable codes
-- ---------------------------------------------------------------------------
create sequence if not exists seq_client_code  start 1 increment 1;
create sequence if not exists seq_trip_code    start 1 increment 1;
create sequence if not exists seq_booking_code start 1 increment 1;
create sequence if not exists seq_invoice_number start 1 increment 1;

-- =============================================================================
-- TABLE: clients
-- =============================================================================
create table clients (
  id               uuid        primary key default gen_random_uuid(),
  client_code      text        unique not null
                               default generate_code('CLI', nextval('seq_client_code')),
  first_name       text        not null,
  last_name        text        not null,
  email            text        unique,
  phone            text,
  address_street   text,
  address_city     text,
  address_zip      text,
  address_country  text        not null default 'Magyarország',
  birth_date       date,
  nationality      text,
  passport_number  text,
  passport_expiry  date,
  source           text        check (source in (
                                 'messenger','website_form','referral','other'
                               )),
  is_vip           boolean     not null default false,
  notes            text,
  trip_count       integer     not null default 0,
  total_spent      decimal(10,2) not null default 0,
  discount_level   integer     not null default 0
                               check (discount_level between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- Indexes
create index idx_clients_email        on clients (email)         where deleted_at is null;
create index idx_clients_last_name    on clients (last_name)     where deleted_at is null;
create index idx_clients_is_vip       on clients (is_vip)        where deleted_at is null;
create index idx_clients_passport_expiry on clients (passport_expiry) where deleted_at is null;
create index idx_clients_source       on clients (source)        where deleted_at is null;
create index idx_clients_deleted_at   on clients (deleted_at);
-- trigram indexes for partial-match search on names / email
create index idx_clients_first_name_trgm  on clients using gin (first_name  gin_trgm_ops);
create index idx_clients_last_name_trgm   on clients using gin (last_name   gin_trgm_ops);
create index idx_clients_email_trgm       on clients using gin (email       gin_trgm_ops);

-- updated_at trigger
create trigger trg_clients_updated_at
  before update on clients
  for each row execute function trigger_set_updated_at();

-- Row Level Security
alter table clients enable row level security;

create policy "clients_service_all"
  on clients for all
  using (auth.role() = 'service_role');

create policy "clients_authenticated_all"
  on clients for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: trips
-- =============================================================================
create table trips (
  id                uuid        primary key default gen_random_uuid(),
  trip_code         text        unique not null
                                default generate_code('TRP', nextval('seq_trip_code')),
  name              text        not null,
  destination       text        not null,
  departure_date    date        not null,
  return_date       date        not null,
  max_capacity      integer     not null check (max_capacity > 0),
  current_bookings  integer     not null default 0
                                check (current_bookings >= 0),
  base_price        decimal(10,2) not null check (base_price >= 0),
  vip_price         decimal(10,2) check (vip_price >= 0),
  description       text,
  status            text        not null default 'planned'
                                check (status in (
                                  'planned','advertised','full','ongoing',
                                  'completed','cancelled'
                                )),
  total_revenue     decimal(10,2) not null default 0,
  total_costs       decimal(10,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint trips_return_after_departure
    check (return_date >= departure_date),
  constraint trips_bookings_lte_capacity
    check (current_bookings <= max_capacity)
);

-- Indexes
create index idx_trips_departure_date  on trips (departure_date)  where deleted_at is null;
create index idx_trips_status          on trips (status)          where deleted_at is null;
create index idx_trips_destination     on trips (destination)     where deleted_at is null;
create index idx_trips_deleted_at      on trips (deleted_at);
create index idx_trips_destination_trgm on trips using gin (destination gin_trgm_ops);
create index idx_trips_name_trgm        on trips using gin (name        gin_trgm_ops);

create trigger trg_trips_updated_at
  before update on trips
  for each row execute function trigger_set_updated_at();

alter table trips enable row level security;

create policy "trips_service_all"
  on trips for all
  using (auth.role() = 'service_role');

create policy "trips_authenticated_all"
  on trips for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: bookings
-- =============================================================================
create table bookings (
  id                  uuid        primary key default gen_random_uuid(),
  booking_code        text        unique not null
                                  default generate_code('BKG', nextval('seq_booking_code')),
  client_id           uuid        not null references clients (id) on delete restrict,
  trip_id             uuid        not null references trips   (id) on delete restrict,
  status              text        not null default 'interested'
                                  check (status in (
                                    'interested','booked','deposit_paid',
                                    'fully_paid','completed','cancelled'
                                  )),
  base_amount         decimal(10,2) check (base_amount >= 0),
  discount_percentage decimal(5,2)  not null default 0
                                  check (discount_percentage between 0 and 100),
  discount_amount     decimal(10,2) not null default 0
                                  check (discount_amount >= 0),
  final_amount        decimal(10,2) check (final_amount >= 0),
  deposit_amount      decimal(10,2) check (deposit_amount >= 0),
  deposit_paid_at     timestamptz,
  fully_paid_at       timestamptz,
  payment_deadline    date,
  notes               text,
  source              text        check (source in (
                                    'messenger','website_form','referral','other'
                                  )),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- Indexes
create index idx_bookings_client_id     on bookings (client_id)      where deleted_at is null;
create index idx_bookings_trip_id       on bookings (trip_id)        where deleted_at is null;
create index idx_bookings_status        on bookings (status)         where deleted_at is null;
create index idx_bookings_payment_deadline on bookings (payment_deadline) where deleted_at is null;
create index idx_bookings_created_at    on bookings (created_at desc) where deleted_at is null;
create index idx_bookings_deleted_at    on bookings (deleted_at);

create trigger trg_bookings_updated_at
  before update on bookings
  for each row execute function trigger_set_updated_at();

alter table bookings enable row level security;

create policy "bookings_service_all"
  on bookings for all
  using (auth.role() = 'service_role');

create policy "bookings_authenticated_all"
  on bookings for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: payments
-- =============================================================================
create table payments (
  id           uuid        primary key default gen_random_uuid(),
  booking_id   uuid        not null references bookings (id) on delete restrict,
  amount       decimal(10,2) not null,
  type         text        not null
               check (type in ('deposit','full_payment','partial','refund')),
  payment_date timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);

-- Indexes
create index idx_payments_booking_id   on payments (booking_id);
create index idx_payments_payment_date on payments (payment_date desc);
create index idx_payments_type         on payments (type);

alter table payments enable row level security;

create policy "payments_service_all"
  on payments for all
  using (auth.role() = 'service_role');

create policy "payments_authenticated_all"
  on payments for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: trip_costs
-- =============================================================================
create table trip_costs (
  id          uuid        primary key default gen_random_uuid(),
  trip_id     uuid        not null references trips (id) on delete restrict,
  description text        not null,
  amount      decimal(10,2) not null check (amount >= 0),
  category    text        check (category in (
                            'accommodation','flight','transfer',
                            'meals','tickets','other'
                          )),
  cost_date   date,
  created_at  timestamptz not null default now()
);

-- Indexes
create index idx_trip_costs_trip_id   on trip_costs (trip_id);
create index idx_trip_costs_category  on trip_costs (category);
create index idx_trip_costs_cost_date on trip_costs (cost_date);

alter table trip_costs enable row level security;

create policy "trip_costs_service_all"
  on trip_costs for all
  using (auth.role() = 'service_role');

create policy "trip_costs_authenticated_all"
  on trip_costs for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: invoices
-- =============================================================================
create table invoices (
  id             uuid        primary key default gen_random_uuid(),
  invoice_number text        unique not null
                             default generate_code('INV', nextval('seq_invoice_number')),
  client_id      uuid        not null references clients  (id) on delete restrict,
  booking_id     uuid        references bookings (id) on delete set null,
  status         text        not null default 'draft'
                             check (status in (
                               'draft','sent','paid','overdue','cancelled'
                             )),
  issue_date     date        not null default current_date,
  due_date       date,
  service_date   date,
  items          jsonb       not null default '[]'::jsonb,
  subtotal       decimal(10,2) check (subtotal >= 0),
  tax_rate       decimal(5,2)  not null default 13
                             check (tax_rate between 0 and 100),
  tax_amount     decimal(10,2) check (tax_amount >= 0),
  total          decimal(10,2) check (total >= 0),
  notes          text,
  sent_at        timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint invoices_due_after_issue
    check (due_date is null or due_date >= issue_date)
);

-- Indexes
create index idx_invoices_client_id      on invoices (client_id);
create index idx_invoices_booking_id     on invoices (booking_id);
create index idx_invoices_status         on invoices (status);
create index idx_invoices_issue_date     on invoices (issue_date desc);
create index idx_invoices_due_date       on invoices (due_date)    where status in ('sent','overdue');

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function trigger_set_updated_at();

alter table invoices enable row level security;

create policy "invoices_service_all"
  on invoices for all
  using (auth.role() = 'service_role');

create policy "invoices_authenticated_all"
  on invoices for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: email_templates
-- =============================================================================
create table email_templates (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  subject    text        not null,
  body       text        not null,
  variables  text[],
  type       text        check (type in (
                           'confirmation','deposit_request','reminder',
                           'pre_trip','post_trip','promotional'
                         )),
  is_default boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one default per type
create unique index idx_email_templates_default_per_type
  on email_templates (type)
  where is_default = true;

-- Indexes
create index idx_email_templates_type       on email_templates (type);
create index idx_email_templates_is_default on email_templates (is_default);

create trigger trg_email_templates_updated_at
  before update on email_templates
  for each row execute function trigger_set_updated_at();

alter table email_templates enable row level security;

create policy "email_templates_service_all"
  on email_templates for all
  using (auth.role() = 'service_role');

create policy "email_templates_authenticated_all"
  on email_templates for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: email_logs
-- =============================================================================
create table email_logs (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        references clients        (id) on delete set null,
  template_id uuid        references email_templates(id) on delete set null,
  booking_id  uuid        references bookings       (id) on delete set null,
  subject     text        not null,
  body        text        not null,
  sent_at     timestamptz not null default now(),
  status      text        check (status in ('sent','failed','opened'))
);

-- Indexes
create index idx_email_logs_client_id   on email_logs (client_id);
create index idx_email_logs_booking_id  on email_logs (booking_id);
create index idx_email_logs_template_id on email_logs (template_id);
create index idx_email_logs_sent_at     on email_logs (sent_at desc);
create index idx_email_logs_status      on email_logs (status);

alter table email_logs enable row level security;

create policy "email_logs_service_all"
  on email_logs for all
  using (auth.role() = 'service_role');

create policy "email_logs_authenticated_all"
  on email_logs for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: notifications
-- =============================================================================
create table notifications (
  id           uuid        primary key default gen_random_uuid(),
  type         text        not null
               check (type in (
                 'passport_expiry','payment_due','new_booking',
                 'trip_soon','low_capacity','payment_overdue'
               )),
  title        text        not null,
  message      text        not null,
  related_id   uuid,
  related_type text,
  is_read      boolean     not null default false,
  created_at   timestamptz not null default now()
);

-- Indexes
create index idx_notifications_is_read    on notifications (is_read)     where is_read = false;
create index idx_notifications_type       on notifications (type);
create index idx_notifications_created_at on notifications (created_at desc);
create index idx_notifications_related    on notifications (related_type, related_id);

alter table notifications enable row level security;

create policy "notifications_service_all"
  on notifications for all
  using (auth.role() = 'service_role');

create policy "notifications_authenticated_all"
  on notifications for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: settings
-- =============================================================================
create table settings (
  id         uuid        primary key default gen_random_uuid(),
  key        text        unique not null,
  value      text,
  updated_at timestamptz not null default now()
);

create index idx_settings_key on settings (key);

create trigger trg_settings_updated_at
  before update on settings
  for each row execute function trigger_set_updated_at();

alter table settings enable row level security;

create policy "settings_service_all"
  on settings for all
  using (auth.role() = 'service_role');

create policy "settings_authenticated_all"
  on settings for all
  using (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: rate_limits
-- =============================================================================
create table rate_limits (
  id           uuid        primary key default gen_random_uuid(),
  ip           text        not null,
  endpoint     text        not null,
  count        integer     not null default 1 check (count > 0),
  window_start timestamptz not null default now()
);

-- Compound index for the lookup pattern (ip + endpoint + window)
create index idx_rate_limits_ip_endpoint      on rate_limits (ip, endpoint);
create index idx_rate_limits_window_start      on rate_limits (window_start);

-- Index for cleanup queries (now() cannot be used in index predicates — app-side cleanup)
create index idx_rate_limits_cleanup on rate_limits (window_start);

alter table rate_limits enable row level security;

create policy "rate_limits_service_all"
  on rate_limits for all
  using (auth.role() = 'service_role');

-- =============================================================================
-- TRIGGERS: maintain denormalised counters
-- =============================================================================

-- clients.trip_count + clients.total_spent
create or replace function sync_client_stats()
returns trigger language plpgsql security definer as $$
begin
  -- recalculate for whichever client was affected
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
  where c.id = coalesce(new.client_id, old.client_id);

  return coalesce(new, old);
end;
$$;

create trigger trg_bookings_sync_client_stats
  after insert or update or delete on bookings
  for each row execute function sync_client_stats();

create trigger trg_payments_sync_client_stats
  after insert or update or delete on payments
  for each row execute function sync_client_stats();

-- trips.current_bookings
create or replace function sync_trip_bookings()
returns trigger language plpgsql security definer as $$
begin
  update trips t
  set current_bookings = (
    select count(*)
    from   bookings b
    where  b.trip_id    = t.id
      and  b.deleted_at is null
      and  b.status not in ('interested','cancelled')
  )
  where t.id = coalesce(new.trip_id, old.trip_id);

  return coalesce(new, old);
end;
$$;

create trigger trg_bookings_sync_trip_bookings
  after insert or update or delete on bookings
  for each row execute function sync_trip_bookings();

-- trips.total_revenue (sum of non-refund payments on this trip's bookings)
-- trips.total_costs   (sum of trip_costs for this trip)
create or replace function sync_trip_financials_from_payment()
returns trigger language plpgsql security definer as $$
declare
  v_trip_id uuid;
begin
  select trip_id into v_trip_id
  from   bookings
  where  id = coalesce(new.booking_id, old.booking_id);

  update trips t
  set total_revenue = (
    select coalesce(sum(
      case when p.type = 'refund' then -p.amount else p.amount end
    ), 0)
    from   payments p
    join   bookings b on b.id = p.booking_id
    where  b.trip_id = t.id
  )
  where t.id = v_trip_id;

  return coalesce(new, old);
end;
$$;

create trigger trg_payments_sync_trip_revenue
  after insert or update or delete on payments
  for each row execute function sync_trip_financials_from_payment();

create or replace function sync_trip_costs_total()
returns trigger language plpgsql security definer as $$
begin
  update trips t
  set total_costs = (
    select coalesce(sum(tc.amount), 0)
    from   trip_costs tc
    where  tc.trip_id = t.id
  )
  where t.id = coalesce(new.trip_id, old.trip_id);

  return coalesce(new, old);
end;
$$;

create trigger trg_trip_costs_sync_total
  after insert or update or delete on trip_costs
  for each row execute function sync_trip_costs_total();

-- =============================================================================
-- FUNCTION: generate passport-expiry notifications (call from cron or app)
-- =============================================================================
create or replace function generate_passport_expiry_notifications()
returns void language plpgsql security definer as $$
begin
  insert into notifications (type, title, message, related_id, related_type)
  select
    'passport_expiry',
    c.last_name || ' ' || c.first_name || ' – útlevél hamarosan lejár',
    'Az útlevél lejárata: ' || to_char(c.passport_expiry, 'YYYY-MM-DD')
      || ' (' || (c.passport_expiry - current_date)::text || ' nap múlva)',
    c.id,
    'client'
  from clients c
  where c.passport_expiry between current_date and current_date + interval '90 days'
    and c.deleted_at is null
    and not exists (
      select 1
      from   notifications n
      where  n.related_id   = c.id
        and  n.related_type = 'client'
        and  n.type         = 'passport_expiry'
        and  n.created_at  >= current_date
    );
end;
$$;

-- =============================================================================
-- FUNCTION: generate payment-due notifications
-- =============================================================================
create or replace function generate_payment_due_notifications()
returns void language plpgsql security definer as $$
begin
  insert into notifications (type, title, message, related_id, related_type)
  select
    'payment_due',
    'Fizetési határidő közeleg – ' || b.booking_code,
    cl.last_name || ' ' || cl.first_name
      || ' foglalásánál a határidő: '
      || to_char(b.payment_deadline, 'YYYY-MM-DD'),
    b.id,
    'booking'
  from bookings b
  join clients cl on cl.id = b.client_id
  where b.payment_deadline between current_date and current_date + interval '7 days'
    and b.status in ('booked','deposit_paid')
    and b.deleted_at is null
    and not exists (
      select 1
      from   notifications n
      where  n.related_id   = b.id
        and  n.related_type = 'booking'
        and  n.type         = 'payment_due'
        and  n.created_at  >= current_date
    );
end;
$$;

-- =============================================================================
-- SEED: default settings
-- =============================================================================
insert into settings (key, value) values
  ('agency_name',        'ZsuzsiTravel'),
  ('agency_email',       ''),
  ('agency_phone',       ''),
  ('agency_address',     ''),
  ('agency_tax_number',  ''),
  ('invoice_prefix',     'INV'),
  ('default_tax_rate',   '13'),
  ('default_currency',   'HUF'),
  ('deposit_percentage', '30'),
  ('vip_discount',       '10')
on conflict (key) do nothing;

-- =============================================================================
-- SEED: default email templates
-- =============================================================================
insert into email_templates (name, subject, body, variables, type, is_default) values
(
  'Foglalás visszaigazolás',
  'Foglalásod visszaigazolása – {{trip_name}}',
  'Kedves {{client_name}}!

Örömmel értesítünk, hogy foglalásodat rögzítettük az alábbi útra:

Út neve: {{trip_name}}
Indulás: {{departure_date}}
Visszaérkezés: {{return_date}}
Foglalás kód: {{booking_code}}
Összeg: {{final_amount}} Ft

Kérdés esetén keress minket bátran!

Üdvözlettel,
{{agency_name}}',
  array['client_name','trip_name','departure_date','return_date','booking_code','final_amount','agency_name'],
  'confirmation',
  true
),
(
  'Előleg bekérő',
  'Előleg befizetési kérelem – {{trip_name}}',
  'Kedves {{client_name}}!

Az alábbi úthoz szükséges az előleg befizetése:

Út neve: {{trip_name}}
Előleg összege: {{deposit_amount}} Ft
Fizetési határidő: {{payment_deadline}}

Bankszámlaszám: {{bank_account}}

Köszönjük!

Üdvözlettel,
{{agency_name}}',
  array['client_name','trip_name','deposit_amount','payment_deadline','bank_account','agency_name'],
  'deposit_request',
  true
),
(
  'Emlékeztető',
  'Emlékeztető – {{trip_name}} fizetési határidő',
  'Kedves {{client_name}}!

Emlékeztetünk, hogy a(z) {{trip_name}} úthoz kapcsolódó befizetési határidőd {{payment_deadline}}.

Foglalás kód: {{booking_code}}
Fennmaradó összeg: {{remaining_amount}} Ft

Üdvözlettel,
{{agency_name}}',
  array['client_name','trip_name','payment_deadline','booking_code','remaining_amount','agency_name'],
  'reminder',
  true
),
(
  'Utazás előtti tájékoztató',
  'Fontos információk az utazásodhoz – {{trip_name}}',
  'Kedves {{client_name}}!

Hamarosan indul a(z) {{trip_name}} utazás! Íme a legfontosabb tudnivalók:

Indulás: {{departure_date}}, {{departure_time}}
Találkozási pont: {{meeting_point}}
Szükséges dokumentumok: útlevél / személyi igazolvány

Kellemes utazást kívánunk!

Üdvözlettel,
{{agency_name}}',
  array['client_name','trip_name','departure_date','departure_time','meeting_point','agency_name'],
  'pre_trip',
  true
),
(
  'Út utáni köszönő',
  'Köszönjük, hogy velünk utaztál! – {{trip_name}}',
  'Kedves {{client_name}}!

Reméljük, hogy élvezted a(z) {{trip_name}} utazást!

Kérünk, oszd meg velünk véleményedet, és ha legközelebb is velünk szeretnél utazni, keress minket bátran!

Üdvözlettel,
{{agency_name}}',
  array['client_name','trip_name','agency_name'],
  'post_trip',
  true
),
(
  'Promóciós hírlevél',
  '{{promo_title}} – Különleges ajánlat!',
  'Kedves {{client_name}}!

{{promo_body}}

Ne hagyd ki ezt a lehetőséget! Foglalj most: {{booking_link}}

Üdvözlettel,
{{agency_name}}',
  array['client_name','promo_title','promo_body','booking_link','agency_name'],
  'promotional',
  true
)
on conflict do nothing;

-- =============================================================================
-- GRANTS (explicit, belt-and-suspenders on top of RLS)
-- =============================================================================
grant usage  on schema public to authenticated, service_role;
grant select, insert, update, delete
  on clients, trips, bookings, payments, trip_costs,
     invoices, email_templates, email_logs, notifications,
     settings, rate_limits
  to authenticated, service_role;

grant usage, select
  on sequence seq_client_code, seq_trip_code,
     seq_booking_code, seq_invoice_number
  to authenticated, service_role;

-- =============================================================================
-- End of migration
-- =============================================================================
