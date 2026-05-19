-- =============================================================================
-- ZsuzsiCRM — Rate limiting table for public booking form
--
-- Used by /api/booking-form to prevent spam submissions.
-- Each row tracks how many times an IP has hit a given endpoint
-- within the current sliding window (default: 5 requests / 1 hour).
--
-- Rows older than the window are deleted by the API route on each request
-- (fire-and-forget cleanup) so the table stays small.
-- =============================================================================

create table if not exists rate_limits (
  id           uuid        primary key default gen_random_uuid(),
  ip           text        not null,
  endpoint     text        not null,
  count        integer     not null default 1,
  window_start timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Fast lookup: find rate-limit record for a given IP + endpoint in a window
create index if not exists idx_rate_limits_ip_endpoint
  on rate_limits (ip, endpoint, window_start desc);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- This table is only written to by the service-role key (admin client used in
-- the API route). Authenticated dashboard users never need to touch it.
alter table rate_limits enable row level security;

-- No policies → only service_role (which bypasses RLS) can read/write.
-- This is intentional: dashboard users should not be able to query or
-- manipulate rate-limit records.

-- =============================================================================
-- Storage bucket: client-documents
--
-- Private bucket for storing per-client files (scanned passport copies,
-- insurance policies, visa approvals, etc.).
-- Files are stored under the path: {client_id}/{timestamp}-{filename}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  52428800,   -- 50 MB per file
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Authenticated users can view client documents
create policy "client_documents_authenticated_select"
  on storage.objects for select
  using (bucket_id = 'client-documents' and auth.role() = 'authenticated');

-- Authenticated users can upload client documents
create policy "client_documents_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'client-documents' and auth.role() = 'authenticated');

-- Authenticated users can update client documents
create policy "client_documents_authenticated_update"
  on storage.objects for update
  using (bucket_id = 'client-documents' and auth.role() = 'authenticated')
  with check (bucket_id = 'client-documents' and auth.role() = 'authenticated');

-- Authenticated users can delete client documents
create policy "client_documents_authenticated_delete"
  on storage.objects for delete
  using (bucket_id = 'client-documents' and auth.role() = 'authenticated');
