-- =============================================================================
-- Client notes — chronological per-client note entries
-- =============================================================================

create table client_notes (
  id         uuid        primary key default gen_random_uuid(),
  client_id  uuid        not null references clients (id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_client_notes_client_id   on client_notes (client_id)   where deleted_at is null;
create index idx_client_notes_created_at  on client_notes (created_at desc);

alter table client_notes enable row level security;

create policy "client_notes_service_all"
  on client_notes for all
  using (auth.role() = 'service_role');

create policy "client_notes_authenticated_all"
  on client_notes for all
  using (auth.role() = 'authenticated');

grant select, insert, update, delete on client_notes to authenticated, service_role;
